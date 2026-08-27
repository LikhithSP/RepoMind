"""
Cross-encoder re-ranking.
CR-16: Re-scores top-k candidates (e.g. 20 down to 5) before generation.
"""
from typing import List, Dict, Any, Optional
from coderag.config import settings

_reranker_instance = None


class CrossEncoderReranker:
    def __init__(self, model_name: str = settings.RERANKER_MODEL):
        self.model_name = model_name
        self._model = None
        self._init_model()

    def _init_model(self):
        try:
            from sentence_transformers import CrossEncoder
            try:
                # Prefer local cache to prevent HuggingFace network latency on requests
                self._model = CrossEncoder(self.model_name, local_files_only=True)
            except Exception:
                self._model = CrossEncoder(self.model_name)
            self.backend = "cross_encoder"
        except Exception:
            self.backend = "lexical_heuristic"

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = settings.RERANK_TOP_K
    ) -> List[Dict[str, Any]]:
        if not candidates:
            return []

        pairs = []
        for c in candidates:
            payload = c.get("payload", {})
            text = payload.get("text", "")
            pairs.append([query, text[:1500]])

        if self.backend == "cross_encoder" and self._model is not None:
            try:
                # Fast predict on CPU
                scores = self._model.predict(pairs, show_progress_bar=False)
            except Exception:
                scores = [self._heuristic_score(query, p[1]) for p in pairs]
        else:
            scores = [self._heuristic_score(query, p[1]) for p in pairs]

        scored_candidates = []
        for i, c in enumerate(candidates):
            score = float(scores[i])
            scored_candidates.append({
                **c,
                "rerank_score": score
            })

        # Sort descending by re-rank score
        scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return scored_candidates[:top_k]

    def _heuristic_score(self, query: str, text: str) -> float:
        """Heuristic scorer when sentence-transformers is offline."""
        q_tokens = set(query.lower().split())
        t_tokens = set(text.lower().split())
        overlap = len(q_tokens.intersection(t_tokens))
        return float(overlap) - 2.0


def get_reranker() -> CrossEncoderReranker:
    global _reranker_instance
    if _reranker_instance is None:
        _reranker_instance = CrossEncoderReranker()
    return _reranker_instance
