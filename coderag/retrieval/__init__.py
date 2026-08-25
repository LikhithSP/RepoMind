"""
Retrieval package exports.
"""
from coderag.retrieval.dense_search import get_embedding_service, EmbeddingService
from coderag.retrieval.bm25_search import get_bm25_index, BM25Index
from coderag.retrieval.hybrid_search import HybridRetriever, reciprocal_rank_fusion
from coderag.retrieval.reranker import get_reranker, CrossEncoderReranker
from coderag.retrieval.router import get_query_router, QueryRouter

__all__ = [
    "get_embedding_service",
    "EmbeddingService",
    "get_bm25_index",
    "BM25Index",
    "HybridRetriever",
    "reciprocal_rank_fusion",
    "get_reranker",
    "CrossEncoderReranker",
    "get_query_router",
    "QueryRouter"
]
