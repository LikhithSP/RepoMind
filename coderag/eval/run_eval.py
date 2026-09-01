"""
Evaluation runner and comparative benchmark suite.
CR-14, CR-15, CR-16: Runs evaluation across Baseline (Dense only) vs Hybrid vs Hybrid+Reranked.
Outputs comparison markdown table ready for README.md and CI logs.
"""
import json
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional

from coderag.config import settings
from coderag.storage.qdrant_store import QdrantStore
from coderag.retrieval.dense_search import get_embedding_service
from coderag.retrieval.bm25_search import get_bm25_index
from coderag.retrieval.hybrid_search import HybridRetriever
from coderag.retrieval.reranker import get_reranker
from coderag.retrieval.router import get_query_router
from coderag.generation.llm_client import LLMClient
from coderag.generation.prompts import format_context_prompt
from coderag.generation.guardrails import check_retrieval_guardrail, NOT_FOUND_RESPONSE
from coderag.eval.custom_metrics import evaluate_citation_accuracy, evaluate_retrieval_hit_rate


async def run_evaluation_benchmark(
    dataset_path: Optional[Path] = None,
    sample_size: Optional[int] = None
) -> Dict[str, Any]:
    path = dataset_path or (settings.BASE_DIR / "coderag" / "eval" / "qa_dataset.json")
    with open(path, "r", encoding="utf-8") as f:
        qa_items = json.load(f)

    if sample_size and sample_size < len(qa_items):
        qa_items = qa_items[:sample_size]

    retriever = HybridRetriever()
    reranker = get_reranker()
    router = get_query_router()
    llm = LLMClient(provider="mock")
    embedder = get_embedding_service()
    qdrant = QdrantStore()
    bm25 = get_bm25_index()

    # Track metrics across three configurations
    # 1. Baseline: Dense vector retrieval only (naive RAG)
    # 2. Hybrid: Dense + BM25 with RRF
    # 3. CodeRAG Full: Hybrid + Cross-Encoder Re-ranking + Guardrails

    configs = ["Baseline (Dense)", "Hybrid (BM25+Dense)", "CodeRAG Full (Hybrid+Rerank)"]
    results = {cfg: {"hit_rate": [], "citation_acc": [], "latency": []} for cfg in configs}

    for item in qa_items:
        query = item["question"]
        expected_files = item.get("expected_files", [])

        # -----------------------------
        # Config 1: Baseline (Dense only)
        # -----------------------------
        t0 = time.time()
        q_vec = embedder.embed_query(query)
        dense_hits = qdrant.search(q_vec, limit=5)
        dense_time = time.time() - t0

        dense_hit = evaluate_retrieval_hit_rate(dense_hits, expected_files, top_k=5)
        prompt_dense = format_context_prompt(query, dense_hits)
        ans_dense = await llm.generate(prompt_dense)
        dense_cite = evaluate_citation_accuracy(ans_dense, expected_files)["score"]

        results["Baseline (Dense)"]["hit_rate"].append(dense_hit)
        results["Baseline (Dense)"]["citation_acc"].append(dense_cite)
        results["Baseline (Dense)"]["latency"].append(dense_time)

        # -----------------------------
        # Config 2: Hybrid (BM25 + Dense)
        # -----------------------------
        t1 = time.time()
        routed = router.classify(query)
        filter_type = routed["intent"] if routed["intent"] != "mixed" else None
        hybrid_out = retriever.retrieve(query, limit=5, filter_type=filter_type)
        hybrid_hits = hybrid_out["results"]
        hybrid_time = time.time() - t1

        hybrid_hit = evaluate_retrieval_hit_rate(hybrid_hits, expected_files, top_k=5)
        prompt_hybrid = format_context_prompt(query, hybrid_hits)
        ans_hybrid = await llm.generate(prompt_hybrid)
        hybrid_cite = evaluate_citation_accuracy(ans_hybrid, expected_files)["score"]

        results["Hybrid (BM25+Dense)"]["hit_rate"].append(hybrid_hit)
        results["Hybrid (BM25+Dense)"]["citation_acc"].append(hybrid_cite)
        results["Hybrid (BM25+Dense)"]["latency"].append(hybrid_time)

        # -----------------------------
        # Config 3: CodeRAG Full (Hybrid + Reranker + Guardrail)
        # -----------------------------
        t2 = time.time()
        # Retrieve top 20 candidates first
        hybrid_top20 = retriever.retrieve(query, limit=20, filter_type=filter_type)
        reranked_hits = reranker.rerank(query, hybrid_top20["results"], top_k=5)

        passed, reason = check_retrieval_guardrail(reranked_hits)
        if not passed:
            ans_full = NOT_FOUND_RESPONSE
        else:
            prompt_full = format_context_prompt(query, reranked_hits)
            ans_full = await llm.generate(prompt_full)
        full_time = time.time() - t2

        full_hit = evaluate_retrieval_hit_rate(reranked_hits, expected_files, top_k=5)
        full_cite = evaluate_citation_accuracy(ans_full, expected_files)["score"]

        results["CodeRAG Full (Hybrid+Rerank)"]["hit_rate"].append(full_hit)
        results["CodeRAG Full (Hybrid+Rerank)"]["citation_acc"].append(full_cite)
        results["CodeRAG Full (Hybrid+Rerank)"]["latency"].append(full_time)

    # Compute aggregate averages
    summary_table = []
    for cfg in configs:
        avg_hit = sum(results[cfg]["hit_rate"]) / len(results[cfg]["hit_rate"]) * 100
        avg_cite = sum(results[cfg]["citation_acc"]) / len(results[cfg]["citation_acc"]) * 100
        avg_lat = sum(results[cfg]["latency"]) / len(results[cfg]["latency"]) * 1000
        summary_table.append({
            "Configuration": cfg,
            "Hit Rate (Recall@5)": f"{avg_hit:.1f}%",
            "Citation Accuracy": f"{avg_cite:.1f}%",
            "Avg Retrieval Latency": f"{avg_lat:.1f} ms"
        })

    return {
        "summary": summary_table,
        "total_queries": len(qa_items)
    }


def print_markdown_report(report: Dict[str, Any]):
    print("\n=======================================================")
    print("CodeRAG Evaluation Benchmark Report")
    print("=======================================================\n")
    print(f"Total Test Queries: {report['total_queries']}\n")
    print("| Configuration | Hit Rate (Recall@5) | Citation Accuracy | Avg Latency |")
    print("|---|---|---|---|")
    for row in report["summary"]:
        print(f"| {row['Configuration']} | {row['Hit Rate (Recall@5)']} | {row['Citation Accuracy']} | {row['Avg Retrieval Latency']} |")
    print("\n=======================================================\n")


if __name__ == "__main__":
    report = asyncio.run(run_evaluation_benchmark())
    print_markdown_report(report)
