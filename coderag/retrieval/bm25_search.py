"""
Sparse BM25 Keyword Search.
CR-6: BM25 index with code-aware tokenization (handles camelCase, snake_case, identifiers).
"""
import re
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Plus
from coderag.config import settings


def code_tokenize(text: str) -> List[str]:
    """Tokenizes code and text by splitting punctuation, snake_case, and camelCase identifiers."""
    # Split camelCase into subwords: handleAuthToken -> handle Auth Token
    s1 = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', text)
    # Extract alpha-numeric tokens
    tokens = re.findall(r'[a-zA-Z0-9_\.\-]+', s1.lower())
    # Sub-split snake_case tokens
    expanded = []
    for t in tokens:
        expanded.append(t)
        if "_" in t or "." in t:
            for sub in re.split(r'[_.]', t):
                if sub:
                    expanded.append(sub)
    return expanded


class BM25Index:
    def __init__(self):
        self.corpus_chunks: List[Dict[str, Any]] = []
        self.bm25: Optional[BM25Plus] = None

    def build_index(self, chunks: List[Dict[str, Any]]):
        self.corpus_chunks = chunks
        tokenized_corpus = [code_tokenize(c.get("text", "")) for c in chunks]
        self.bm25 = BM25Plus(tokenized_corpus)

    def save(self, path: Optional[Path] = None):
        target = path or settings.BM25_INDEX_PATH
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as f:
            pickle.dump({"chunks": self.corpus_chunks, "bm25": self.bm25}, f)

    def load(self, path: Optional[Path] = None) -> bool:
        target = path or settings.BM25_INDEX_PATH
        if not target.exists():
            return False
        try:
            with open(target, "rb") as f:
                data = pickle.load(f)
                self.corpus_chunks = data["chunks"]
                self.bm25 = data["bm25"]
            return True
        except Exception:
            return False

    def search(self, query: str, limit: int = 20, filter_type: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.bm25 or not self.corpus_chunks:
            return []

        tokens = code_tokenize(query)
        if not tokens:
            return []

        scores = self.bm25.get_scores(tokens)

        # Pair scores with chunk
        indexed_scores = []
        for idx, score in enumerate(scores):
            if score <= 0.0:
                continue
            chunk = self.corpus_chunks[idx]
            if filter_type and filter_type != "mixed" and chunk.get("type") != filter_type:
                continue
            indexed_scores.append((idx, float(score), chunk))

        # Sort descending by score
        indexed_scores.sort(key=lambda x: x[1], reverse=True)
        top_k = indexed_scores[:limit]

        results = []
        for idx, score, chunk in top_k:
            results.append({
                "id": str(idx),
                "score": score,
                "payload": chunk
            })
        return results


_bm25_instance = None


def get_bm25_index() -> BM25Index:
    global _bm25_instance
    if _bm25_instance is None:
        _bm25_instance = BM25Index()
        _bm25_instance.load()
    return _bm25_instance
