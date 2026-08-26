"""
Hybrid search with Reciprocal Rank Fusion (RRF).
CR-8: Combines dense vector search with BM25 sparse keyword ranking.
"""
from typing import List, Dict, Any, Optional
from coderag.storage.qdrant_store import QdrantStore
from coderag.retrieval.dense_search import get_embedding_service
from coderag.retrieval.bm25_search import get_bm25_index


def reciprocal_rank_fusion(
    dense_results: List[Dict[str, Any]],
    bm25_results: List[Dict[str, Any]],
    k: int = 60,
    top_n: int = 20
) -> List[Dict[str, Any]]:
    """
    RRF(d) = sum(1 / (k + rank_i(d)))
    Aggregates ranked lists from multiple retrieval mechanisms.
    """
    rrf_scores: Dict[str, float] = {}
    chunk_map: Dict[str, Dict[str, Any]] = {}
    dense_ranks: Dict[str, int] = {}
    bm25_ranks: Dict[str, int] = {}

    # Score dense ranks
    for rank, item in enumerate(dense_results, start=1):
        # Unique chunk key by file_path + start_line + symbol_name
        payload = item.get("payload", {})
        key = f"{payload.get('file_path')}:{payload.get('start_line')}:{payload.get('symbol_name', '')}"
        chunk_map[key] = payload
        dense_ranks[key] = rank
        rrf_scores[key] = rrf_scores.get(key, 0.0) + (1.0 / (k + rank))

    # Score BM25 ranks
    for rank, item in enumerate(bm25_results, start=1):
        payload = item.get("payload", {})
        key = f"{payload.get('file_path')}:{payload.get('start_line')}:{payload.get('symbol_name', '')}"
        if key not in chunk_map:
            chunk_map[key] = payload
        bm25_ranks[key] = rank
        rrf_scores[key] = rrf_scores.get(key, 0.0) + (1.0 / (k + rank))

    # Sort descending by RRF score
    sorted_items = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    fused = []
    for key, score in sorted_items[:top_n]:
        fused.append({
            "key": key,
            "rrf_score": score,
            "dense_rank": dense_ranks.get(key),
            "bm25_rank": bm25_ranks.get(key),
            "payload": chunk_map[key]
        })
    return fused


class HybridRetriever:
    def __init__(self, qdrant_store: Optional[QdrantStore] = None):
        self.qdrant_store = qdrant_store or QdrantStore()
        self.embedding_service = get_embedding_service()
        self.bm25_index = get_bm25_index()

    def retrieve(
        self,
        query: str,
        limit: int = 20,
        filter_type: Optional[str] = None
    ) -> Dict[str, Any]:
        # 1. Dense retrieval
        query_vec = self.embedding_service.embed_query(query)
        dense_hits = self.qdrant_store.search(query_vec, limit=limit, filter_type=filter_type)

        # 2. Sparse BM25 retrieval
        bm25_hits = self.bm25_index.search(query, limit=limit, filter_type=filter_type)

        # 3. Reciprocal Rank Fusion
        fused = reciprocal_rank_fusion(dense_hits, bm25_hits, k=60, top_n=limit)

        return {
            "query": query,
            "filter_type": filter_type,
            "dense_count": len(dense_hits),
            "bm25_count": len(bm25_hits),
            "results": fused
        }
