"""
Unified Ingestion Pipeline Orchestrator.
Coordinates repo cloning, code/docs/issues chunking, embedding, Qdrant upsert, and BM25 index creation.
Provides a streaming generator variant that yields progress events for SSE responses.
"""
from pathlib import Path
from typing import Dict, Any, Optional, Generator
import time
import uuid
from qdrant_client.http.models import PointStruct

from coderag.config import settings
from coderag.ingestion.clone_repo import clone_or_update_repo
from coderag.ingestion.chunk_code import chunk_code_repository
from coderag.ingestion.chunk_docs import chunk_docs_repository
from coderag.ingestion.chunk_issues import chunk_issues
from coderag.storage.qdrant_store import QdrantStore
from coderag.retrieval.dense_search import get_embedding_service
from coderag.retrieval.bm25_search import get_bm25_index


def run_ingestion_pipeline_streaming(
    repo_url: Optional[str] = None,
    repo_name: Optional[str] = None,
    local_repo_dir: Optional[Path] = None
) -> Generator[Dict[str, Any], None, None]:
    """
    Streaming variant of the ingestion pipeline.
    Yields progress event dicts at each stage so the caller can SSE-stream them to the client.
    Each dict has at least: {"stage": str, "message": str, ...extra}
    Final event also has "status": "success" and full result payload.
    """
    start_time = time.time()
    url = repo_url or settings.TARGET_REPO_URL
    name = repo_name or settings.TARGET_REPO_NAME

    # ── Stage 1: Cloning ────────────────────────────────────────────────────
    yield {
        "stage": "cloning",
        "message": f"Cloning repository {url.split('/')[-1]}…",
        "progress": 10
    }

    try:
        if local_repo_dir and local_repo_dir.exists():
            repo_info = {
                "repo_url": url,
                "repo_path": str(local_repo_dir),
                "commit_sha": "local_workspace_sha"
            }
        else:
            repo_info = clone_or_update_repo(url)
    except Exception as e:
        yield {"stage": "error", "message": f"Clone failed: {str(e)}", "progress": 0}
        return

    target_path = Path(repo_info["repo_path"])
    commit_sha = repo_info["commit_sha"]

    yield {
        "stage": "cloning",
        "message": f"Cloned at commit {commit_sha[:7]}",
        "progress": 20
    }

    # ── Stage 2: Code chunking ───────────────────────────────────────────────
    yield {
        "stage": "chunking",
        "message": "Parsing AST and chunking source files…",
        "progress": 30
    }

    try:
        code_chunks = chunk_code_repository(target_path)
    except Exception as e:
        code_chunks = []

    yield {
        "stage": "chunking",
        "message": f"Parsed {len(code_chunks)} code chunks",
        "progress": 45
    }

    # ── Stage 3: Docs + Issues ───────────────────────────────────────────────
    yield {
        "stage": "chunking",
        "message": "Indexing markdown docs and issues…",
        "progress": 50
    }

    try:
        doc_chunks = chunk_docs_repository(target_path)
    except Exception:
        doc_chunks = []

    try:
        issue_chunks = chunk_issues(name)
    except Exception:
        issue_chunks = []

    # Balanced capping so all types are indexed
    all_chunks = code_chunks[:80] + doc_chunks[:20] + issue_chunks

    # Attach metadata to each chunk
    for c in all_chunks:
        c["repo_commit_sha"] = commit_sha
        c["repo_name"] = name

    yield {
        "stage": "chunking",
        "message": f"Total {len(all_chunks)} chunks ready ({len(code_chunks[:80])} code · {len(doc_chunks[:20])} docs · {len(issue_chunks)} issues)",
        "progress": 58
    }

    # ── Stage 4: BM25 sparse index ───────────────────────────────────────────
    yield {
        "stage": "indexing",
        "message": "Building BM25 sparse index…",
        "progress": 62
    }

    try:
        bm25 = get_bm25_index()
        bm25.build_index(all_chunks)
        bm25.save()
    except Exception as e:
        yield {"stage": "error", "message": f"BM25 index failed: {str(e)}", "progress": 62}
        return

    # ── Stage 5: Embedding ───────────────────────────────────────────────────
    yield {
        "stage": "embedding",
        "message": f"Embedding {len(all_chunks)} chunks with fastembed…",
        "progress": 68
    }

    try:
        embedder = get_embedding_service()
        texts = [c["text"] for c in all_chunks]
        embeddings = embedder.embed_documents(texts)
    except Exception as e:
        yield {"stage": "error", "message": f"Embedding failed: {str(e)}", "progress": 68}
        return

    yield {
        "stage": "embedding",
        "message": "Embeddings generated",
        "progress": 82
    }

    # ── Stage 6: Upsert to Qdrant ────────────────────────────────────────────
    yield {
        "stage": "storing",
        "message": "Upserting vectors into Qdrant…",
        "progress": 85
    }

    try:
        store = QdrantStore()
        points = []
        for i, chunk in enumerate(all_chunks):
            point_id = str(uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f"{chunk.get('file_path')}:{chunk.get('start_line')}:{i}"
            ))
            points.append(PointStruct(
                id=point_id,
                vector=embeddings[i],
                payload=chunk
            ))
        store.upsert_points(points)
    except Exception as e:
        yield {"stage": "error", "message": f"Qdrant upsert failed: {str(e)}", "progress": 85}
        return

    elapsed = round(time.time() - start_time, 2)

    # ── Stage 7: Done ────────────────────────────────────────────────────────
    yield {
        "stage": "done",
        "message": f"Indexed {len(all_chunks)} chunks in {elapsed}s",
        "progress": 100,
        "status": "success",
        "repo_name": name,
        "commit_sha": commit_sha,
        "chunks_ingested": {
            "code": len(code_chunks),
            "docs": len(doc_chunks),
            "issues": len(issue_chunks),
            "total": len(all_chunks)
        },
        "elapsed_seconds": elapsed
    }


def run_ingestion_pipeline(
    repo_url: Optional[str] = None,
    repo_name: Optional[str] = None,
    local_repo_dir: Optional[Path] = None
) -> Dict[str, Any]:
    """Blocking (non-streaming) variant for backward compatibility."""
    result: Dict[str, Any] = {}
    for event in run_ingestion_pipeline_streaming(
        repo_url=repo_url,
        repo_name=repo_name,
        local_repo_dir=local_repo_dir
    ):
        if event.get("stage") in ("done", "error"):
            result = event
    return result
