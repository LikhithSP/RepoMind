"""
FastAPI Application for CodeRAG.
Provides SSE Streaming for /query, raw retrieval for /retrieve, health check, and protected /reindex.
"""
import time
import json
import asyncio
from typing import AsyncGenerator, Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from coderag.config import settings
from coderag.api.schemas import (
    QueryRequest,
    QueryResponse,
    RetrieveRequest,
    SourceChunk,
    TraceInfo,
    ReindexRequest,
    ReindexResponse,
    HealthResponse
)
from coderag.storage.qdrant_store import QdrantStore
from coderag.retrieval.bm25_search import get_bm25_index
from coderag.retrieval.hybrid_search import HybridRetriever
from coderag.retrieval.reranker import get_reranker
from coderag.retrieval.router import get_query_router
from coderag.generation.llm_client import LLMClient
from coderag.generation.prompts import format_context_prompt
from coderag.generation.guardrails import check_retrieval_guardrail, NOT_FOUND_RESPONSE
from coderag.ingestion.pipeline import run_ingestion_pipeline, run_ingestion_pipeline_streaming
from coderag.observability.tracer import RequestTracer

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context. Pre-warms embedding and reranking models, and restores ingested repo if needed."""
    loop = asyncio.get_running_loop()
    def _warmup():
        try:
            get_embedding_service()
            get_reranker()
            store = QdrantStore()
            bm25 = get_bm25_index()
            # If Qdrant is empty (e.g. freshly started in-memory) but we have indexed chunks on disk
            if store.count() == 0 and bm25.corpus_chunks:
                import uuid
                from qdrant_client.http.models import PointStruct
                embedder = get_embedding_service()
                texts = [c.get("text", "") for c in bm25.corpus_chunks]
                embeddings = embedder.embed_documents(texts)
                points = []
                for i, chunk in enumerate(bm25.corpus_chunks):
                    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{chunk.get('file_path')}:{chunk.get('start_line')}:{i}"))
                    points.append(PointStruct(id=point_id, vector=embeddings[i], payload=chunk))
                store.upsert_points(points)
                first_chunk = bm25.corpus_chunks[0]
                if first_chunk.get("repo_name"):
                    settings.TARGET_REPO_NAME = first_chunk["repo_name"]
        except Exception:
            pass
    await loop.run_in_executor(None, _warmup)
    yield


app = FastAPI(
    title="CodeRAG API",
    description="Agentic RAG Assistant for Codebases with Hybrid Retrieval, Re-ranking, and SSE streaming",
    version="0.1.0",
    lifespan=lifespan
)


# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production via settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    store = QdrantStore()
    bm25 = get_bm25_index()
    count = store.count()

    active_repo_name = settings.TARGET_REPO_NAME
    active_commit_sha = None

    # If chunks exist, pull the actual ingested repo name and commit sha
    if bm25.corpus_chunks:
        first_chunk = bm25.corpus_chunks[0]
        if first_chunk.get("repo_name"):
            active_repo_name = first_chunk["repo_name"]
            settings.TARGET_REPO_NAME = active_repo_name
        if first_chunk.get("repo_commit_sha"):
            active_commit_sha = first_chunk["repo_commit_sha"][:7]

    return HealthResponse(
        status="healthy",
        qdrant_status="connected",
        indexed_points=max(count, len(bm25.corpus_chunks)),
        bm25_indexed_chunks=len(bm25.corpus_chunks),
        repo_name=active_repo_name,
        commit_sha=active_commit_sha,
        has_groq_key=bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())
    )


@app.post("/retrieve")
async def retrieve_candidates(req: RetrieveRequest):
    start_time = time.time()
    router = get_query_router()
    retriever = HybridRetriever()
    reranker = get_reranker()

    routed = router.classify(req.query)
    filter_type = req.filter_type or (routed["intent"] if routed["intent"] != "mixed" else None)

    # 1. Hybrid retrieve
    hybrid_out = retriever.retrieve(req.query, limit=req.limit or 20, filter_type=filter_type)

    # 2. Re-rank
    reranked = reranker.rerank(req.query, hybrid_out["results"], top_k=min(5, req.limit or 5))
    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "query": req.query,
        "routing": routed,
        "latency_ms": elapsed_ms,
        "fused_count": len(hybrid_out["results"]),
        "candidates": reranked
    }


@app.post("/query")
async def query_endpoint(req: QueryRequest):
    """
    SSE Streaming endpoint for CodeRAG.
    Streams answer tokens as they arrive, and yields a final JSON event with sources and debug trace.
    """
    start_time = time.time()
    tracer = RequestTracer(req.query, req.model or settings.DEFAULT_MODEL)

    router = get_query_router()
    retriever = HybridRetriever()
    reranker = get_reranker()
    llm = LLMClient(
        provider=req.provider or settings.LLM_PROVIDER,
        model=req.model or settings.DEFAULT_MODEL,
        api_key=req.api_key
    )

    # Run CPU retrieval and reranking in thread pool to prevent blocking event loop
    loop = asyncio.get_running_loop()

    # Step 1: Agentic Routing
    routed = router.classify(req.query)
    filter_type = req.filter_type or (routed["intent"] if routed["intent"] != "mixed" else None)
    tracer.log_step("routing", routed)

    # Step 2 & 3: Hybrid Retrieval and Reranking offloaded to thread
    def _retrieve_and_rerank():
        h_res = retriever.retrieve(req.query, limit=settings.RETRIEVAL_TOP_K, filter_type=filter_type)
        r_chunks = reranker.rerank(req.query, h_res["results"], top_k=req.top_k or settings.RERANK_TOP_K)
        return h_res, r_chunks

    hybrid_res, reranked_chunks = await loop.run_in_executor(None, _retrieve_and_rerank)
    tracer.log_step("hybrid_retrieval", {
        "dense_count": hybrid_res["dense_count"],
        "bm25_count": hybrid_res["bm25_count"],
        "total_fused": len(hybrid_res["results"])
    })
    tracer.log_step("reranking", {"top_k": len(reranked_chunks)})

    # Step 4: Guardrail Confidence Evaluation
    guardrail_passed, guardrail_reason = check_retrieval_guardrail(reranked_chunks)
    tracer.log_step("guardrail", {"passed": guardrail_passed, "reason": guardrail_reason})

    # Format Source Chunks for client
    formatted_sources = []
    for c in reranked_chunks:
        p = c.get("payload", {})
        formatted_sources.append({
            "file_path": p.get("file_path", "unknown"),
            "start_line": p.get("start_line", 1),
            "end_line": p.get("end_line", 1),
            "type": p.get("type", "code"),
            "symbol_name": p.get("symbol_name"),
            "heading_path": p.get("heading_path"),
            "text": p.get("text", ""),
            "rerank_score": round(c.get("rerank_score", 0.0), 3),
            "rrf_score": round(c.get("rrf_score", 0.0), 4),
            "url": p.get("url")
        })

    async def event_generator() -> AsyncGenerator[Dict[str, str], None]:
        full_answer = []

        # Send initial progress state
        yield {
            "event": "status",
            "data": json.dumps({"status": "generating", "intent": routed["intent"]})
        }

        if not guardrail_passed:
            # Skip LLM to prevent hallucinations when confidence is low
            chunk = NOT_FOUND_RESPONSE
            full_answer.append(chunk)
            yield {
                "event": "token",
                "data": json.dumps({"token": chunk})
            }
        else:
            prompt = format_context_prompt(req.query, reranked_chunks)

            try:
                async for token in llm.generate_stream(prompt):
                    full_answer.append(token)
                    yield {
                        "event": "token",
                        "data": json.dumps({"token": token})
                    }
            except Exception as stream_err:
                err_msg = f"\n\n*(Error during streaming: {str(stream_err)})*"
                full_answer.append(err_msg)
                yield {
                    "event": "token",
                    "data": json.dumps({"token": err_msg})
                }


        # Send final completion event with all sources and trace
        tracer.log_step("completion", {
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "tokens_generated": len(full_answer)
        })
        trace_dict = tracer.get_trace()
        trace_info = {
            "intent": routed["intent"],
            "router_reason": routed["reason"],
            "scores": routed["scores"],
            "retrieved_count": len(hybrid_res["results"]),
            "reranked_count": len(reranked_chunks),
            "guardrail_passed": guardrail_passed,
            "guardrail_reason": guardrail_reason,
            "latency_ms": trace_dict["latency_ms"],
            "model": req.model or settings.DEFAULT_MODEL,
            "provider": req.provider or settings.LLM_PROVIDER
        }

        # Yield final completion payload with sources and trace
        yield {
            "event": "done",
            "data": json.dumps({
                "answer": "".join(full_answer),
                "sources": formatted_sources,
                "trace": trace_info
            })
        }

    return EventSourceResponse(event_generator())



@app.post("/reindex")
async def trigger_reindex(
    req: ReindexRequest,
    x_api_key: Optional[str] = Header(None, description="Admin API key for protected reindexing")
):
    """
    SSE Streaming reindex endpoint.
    Streams progress events (stage, message, progress%) as the pipeline runs:
    cloning → chunking → embedding → storing → done.
    """
    if x_api_key and x_api_key != settings.REINDEX_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid reindex API key."
        )

    url = req.repo_url or settings.TARGET_REPO_URL
    name = req.repo_name
    if not name and url:
        name = url.rstrip("/").split("/")[-1].replace(".git", "")

    loop = asyncio.get_running_loop()

    # Use a queue to bridge the sync generator and async SSE response
    import queue as _queue
    event_queue: _queue.Queue = _queue.Queue()

    def _run_pipeline():
        try:
            for event in run_ingestion_pipeline_streaming(repo_url=url, repo_name=name):
                event_queue.put(event)
        except Exception as e:
            event_queue.put({"stage": "error", "message": str(e), "progress": 0})
        finally:
            event_queue.put(None)  # Sentinel to signal completion

    async def event_generator() -> AsyncGenerator[Dict[str, str], None]:
        # Start the blocking pipeline in a thread
        future = loop.run_in_executor(None, _run_pipeline)

        while True:
            # Poll queue with a short sleep to avoid busy-waiting
            try:
                event = await loop.run_in_executor(None, lambda: event_queue.get(timeout=0.1))
            except Exception:
                # Timeout – check if future is done
                if future.done():
                    break
                continue

            if event is None:
                break  # Sentinel received

            stage = event.get("stage", "progress")
            event_data = {
                "stage": stage,
                "message": event.get("message", ""),
                "progress": event.get("progress", 0)
            }

            # If done, include the full result payload
            if stage == "done":
                event_data.update({
                    "status": event.get("status", "success"),
                    "repo_name": event.get("repo_name", name),
                    "commit_sha": event.get("commit_sha", ""),
                    "chunks_ingested": event.get("chunks_ingested", {}),
                    "elapsed_seconds": event.get("elapsed_seconds", 0)
                })
                # Update settings for subsequent queries
                settings.TARGET_REPO_URL = url
                settings.TARGET_REPO_NAME = name or ""

            yield {
                "event": stage,
                "data": json.dumps(event_data)
            }

            if stage in ("done", "error"):
                break

        await future  # Ensure thread cleanup

    return EventSourceResponse(event_generator())

