"""
Unit and integration tests for CodeRAG components.
"""
import pytest
from pathlib import Path
from coderag.ingestion.chunk_code import chunk_python_file
from coderag.ingestion.chunk_docs import chunk_markdown_file
from coderag.retrieval.bm25_search import BM25Index, code_tokenize
from coderag.retrieval.hybrid_search import reciprocal_rank_fusion
from coderag.retrieval.router import QueryRouter
from coderag.generation.guardrails import check_retrieval_guardrail
from coderag.eval.custom_metrics import extract_citations, evaluate_citation_accuracy


def test_code_chunking_preserves_functions(tmp_path):
    code_content = '''"""Sample module docstring."""

class PaymentGateway:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def process_charge(self, amount: float) -> bool:
        """Charges a card amount."""
        if amount <= 0:
            raise ValueError("Invalid amount")
        return True

def standalone_helper(x: int) -> int:
    return x * 2
'''
    py_file = tmp_path / "payment.py"
    py_file.write_text(code_content, encoding="utf-8")

    chunks = chunk_python_file(py_file, "src/payment.py")
    assert len(chunks) >= 3

    symbols = [c["symbol_name"] for c in chunks]
    assert "PaymentGateway.process_charge" in symbols
    assert "PaymentGateway" in symbols
    assert "standalone_helper" in symbols

    # Check function chunk bounds
    func_chunk = next(c for c in chunks if c["symbol_name"] == "PaymentGateway.process_charge")
    assert func_chunk["start_line"] == 7
    assert func_chunk["end_line"] == 11
    assert "def process_charge" in func_chunk["text"]


def test_markdown_chunking_retains_hierarchy(tmp_path):
    doc_content = """# System Guide

Welcome to the system.

## Setup Instructions

Ensure Python 3.11 is installed.

### Environment Variables

Set `API_KEY` in your `.env` file.
"""
    md_file = tmp_path / "guide.md"
    md_file.write_text(doc_content, encoding="utf-8")

    chunks = chunk_markdown_file(md_file, "docs/guide.md")
    assert len(chunks) == 3

    paths = [c["heading_path"] for c in chunks]
    assert any("Setup Instructions" in p for p in paths)
    assert any("Environment Variables" in p for p in paths)


def test_code_tokenization_and_bm25():
    tokens = code_tokenize("def handleAuthToken_v2(request_session):")
    assert "handle" in tokens
    assert "auth" in tokens
    assert "token" in tokens
    assert "v2" in tokens
    assert "request" in tokens
    assert "session" in tokens

    chunks = [
        {"text": "def handleAuthToken(): verifies jwt bearer token", "file_path": "auth.py", "start_line": 1},
        {"text": "class DatabasePool: manages postgres connections", "file_path": "db.py", "start_line": 1},
    ]
    bm25 = BM25Index()
    bm25.build_index(chunks)
    results = bm25.search("authToken")
    assert len(results) > 0
    assert results[0]["payload"]["file_path"] == "auth.py"


def test_reciprocal_rank_fusion():
    dense = [{"payload": {"file_path": "a.py", "start_line": 1}}]
    bm25 = [
        {"payload": {"file_path": "b.py", "start_line": 10}},
        {"payload": {"file_path": "a.py", "start_line": 1}}
    ]
    fused = reciprocal_rank_fusion(dense, bm25, k=60, top_n=2)
    assert len(fused) == 2
    # a.py was present in both, should have higher RRF score
    assert fused[0]["payload"]["file_path"] == "a.py"


def test_query_router():
    router = QueryRouter()
    r1 = router.classify("Where is the handle_request function implemented in auth.py?")
    assert r1["intent"] == "code"

    r2 = router.classify("How do I install the prerequisites and setup the environment from the readme guide?")
    assert r2["intent"] == "doc"

    r3 = router.classify("What is the discussion about the connection timeout crash bug in issue #5930?")
    assert r3["intent"] == "issue"


def test_guardrails_low_confidence():
    empty_passed, _ = check_retrieval_guardrail([])
    assert empty_passed is False

    low_score_chunks = [{"rerank_score": -9.2, "payload": {"text": "irrelevant"}}]
    low_passed, _ = check_retrieval_guardrail(low_score_chunks, threshold=-4.5)
    assert low_passed is False

    high_score_chunks = [{"rerank_score": 1.8, "payload": {"text": "relevant code"}}]
    high_passed, _ = check_retrieval_guardrail(high_score_chunks, threshold=-4.5)
    assert high_passed is True


def test_citation_extraction_and_accuracy():
    ans = "The middleware is defined in `[src/auth.py:20-45]` and config is in `[config.py:10]`."
    citations = extract_citations(ans)
    assert len(citations) == 2
    assert citations[0]["file_path"] == "src/auth.py"
    assert citations[0]["start_line"] == 20
    assert citations[0]["end_line"] == 45

    res = evaluate_citation_accuracy(ans, ["src/auth.py"])
    assert res["matched_expected_file"] is True
    assert res["score"] == 1.0
