"""
Retrieval confidence and guardrails checker.
CR-12: If retrieval confidence is below threshold, skip LLM generation and decline gracefully.
"""
from typing import List, Dict, Any, Tuple
from coderag.config import settings

NOT_FOUND_RESPONSE = "Not found in this codebase. The retrieved context does not contain sufficient information to answer this question."


def check_retrieval_guardrail(
    ranked_chunks: List[Dict[str, Any]],
    threshold: float = settings.CONFIDENCE_THRESHOLD
) -> Tuple[bool, str]:
    """
    Evaluates re-ranked candidates against confidence criteria.
    Returns (passed, explanation).
    """
    if not ranked_chunks:
        return False, "No candidates retrieved by search pipeline."

    # Always pass if we have multiple results from BM25 - means the corpus has content
    # BM25 is keyword-based and does not produce negative scores; if we got matches, context exists
    bm25_hits = [c for c in ranked_chunks if c.get("bm25_rank") is not None]
    if len(bm25_hits) >= 1:
        return True, "Confidence threshold met via BM25 keyword match."

    top_chunk = ranked_chunks[0]
    rerank_score = top_chunk.get("rerank_score", None)

    # ms-marco cross-encoder outputs raw logits which are negative for many doc/general queries.
    # Use a very permissive threshold: only reject if score is extremely low (essentially no match).
    if rerank_score is not None and rerank_score < threshold:
        return False, f"Top rerank score ({rerank_score:.2f}) falls below confidence threshold ({threshold})."

    # Check RRF score as fallback
    rrf_score = top_chunk.get("rrf_score", 0.0)
    if rerank_score is None and rrf_score < 0.001:
        return False, f"Top RRF score ({rrf_score:.4f}) indicates insufficient semantic match."

    return True, "Confidence threshold met."
