"""
Qdrant Storage wrapper for CodeRAG.
Supports embedded in-memory/disk Qdrant as well as external Docker instances.
"""
from typing import List, Dict, Any, Optional
import os
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

from coderag.config import settings

_qdrant_client_singleton = None


def get_shared_qdrant_client() -> QdrantClient:
    global _qdrant_client_singleton
    if _qdrant_client_singleton is None:
        url = settings.QDRANT_URL
        if url == ":memory:":
            _qdrant_client_singleton = QdrantClient(location=":memory:")
        elif url.startswith("http://") or url.startswith("https://"):
            _qdrant_client_singleton = QdrantClient(url=url, api_key=settings.QDRANT_API_KEY)
        else:
            path = Path(url)
            path.mkdir(parents=True, exist_ok=True)
            try:
                _qdrant_client_singleton = QdrantClient(path=str(path))
            except Exception:
                # Fallback to memory if local directory has portalocker lock
                _qdrant_client_singleton = QdrantClient(location=":memory:")
    return _qdrant_client_singleton


_hydrated = False

class QdrantStore:
    def __init__(self, collection_name: Optional[str] = None):
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_NAME
        self.client = get_shared_qdrant_client()
        self._ensure_collection()

    def _ensure_collection(self):
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)
        if not exists:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=settings.EMBEDDING_DIM,
                    distance=Distance.COSINE
                )
            )


    def upsert_points(self, points: List[PointStruct]):
        if not points:
            return
        # Batch upload with optimal bulk sizing
        batch_size = 256
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            self.client.upsert(
                collection_name=self.collection_name,
                points=batch
            )

    def search(
        self,
        query_vector: List[float],
        limit: int = 20,
        filter_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query_filter = None
        if filter_type and filter_type != "mixed":
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="type",
                        match=MatchValue(value=filter_type)
                    )
                ]
            )

        # Support both qdrant-client >= 1.10 (query_points) and older (< 1.10 search)
        if hasattr(self.client, "query_points"):
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                limit=limit,
                query_filter=query_filter,
                with_payload=True
            )
            results = response.points
        elif hasattr(self.client, "search"):
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=limit,
                query_filter=query_filter,
                with_payload=True
            )
        else:
            results = []

        formatted = []
        for r in results:
            formatted.append({
                "id": str(r.id),
                "score": float(r.score) if hasattr(r, "score") and r.score is not None else 0.0,
                "payload": r.payload
            })
        return formatted

    def count(self) -> int:
        try:
            return self.client.count(collection_name=self.collection_name).count
        except Exception:
            return 0
