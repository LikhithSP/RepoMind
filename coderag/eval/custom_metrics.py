"""
Custom Evaluation Metrics.
CR-17: Citation accuracy and source match metrics.
Checks if generated answer contains valid file:line citations and if retrieved files match ground truth.
"""
import re
from typing import List, Dict, Any, Set


def extract_citations(answer: str) -> List[Dict[str, str]]:
    """
    Extracts citation references of the form [file:start-end] or [file:line].
    """
    # Matches patterns like [requests/sessions.py:45-68] or [docs/install.md:12]
    pattern = r'\[([a-zA-Z0-9_\-\.\/]+)(?::(\d+)(?:-(\d+))?)?\]'
    matches = re.findall(pattern, answer)
    citations = []
    for m in matches:
        file_path = m[0]
        start_line = m[1] if m[1] else None
        end_line = m[2] if m[2] else start_line
        citations.append({
            "file_path": file_path,
            "start_line": int(start_line) if start_line else None,
            "end_line": int(end_line) if end_line else None
        })
    return citations


def evaluate_citation_accuracy(
    answer: str,
    expected_files: List[str]
) -> Dict[str, Any]:
    """
    Computes whether the answer includes valid citations and whether cited files match ground truth.
    """
    citations = extract_citations(answer)
    has_citations = len(citations) > 0

    if not expected_files:
        # Negative / out-of-scope query
        is_correct_negative = "not found in this codebase" in answer.lower()
        return {
            "has_citations": has_citations,
            "citation_count": len(citations),
            "matched_expected_file": is_correct_negative,
            "score": 1.0 if is_correct_negative else 0.0
        }

    cited_files = {c["file_path"].lower() for c in citations}
    matched = False
    for ef in expected_files:
        ef_clean = ef.lower()
        if any(ef_clean in cf or cf in ef_clean for cf in cited_files):
            matched = True
            break

    score = 1.0 if (has_citations and matched) else (0.5 if has_citations else 0.0)

    return {
        "has_citations": has_citations,
        "citation_count": len(citations),
        "matched_expected_file": matched,
        "score": score
    }


def evaluate_retrieval_hit_rate(
    retrieved_chunks: List[Dict[str, Any]],
    expected_files: List[str],
    top_k: int = 5
) -> float:
    """Computes Top-K Hit Rate (recall) for retrieved context chunks."""
    if not expected_files:
        return 1.0

    retrieved_files = []
    for c in retrieved_chunks[:top_k]:
        payload = c.get("payload", {})
        fp = payload.get("file_path", "").lower()
        retrieved_files.append(fp)

    for ef in expected_files:
        ef_clean = ef.lower()
        if any(ef_clean in rf or rf in ef_clean for rf in retrieved_files):
            return 1.0

    return 0.0
