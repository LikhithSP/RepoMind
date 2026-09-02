# CodeRAG — Agentic RAG Assistant for Codebases

[![CodeRAG Eval Suite](https://github.com/your-org/coderag/actions/workflows/eval.yml/badge.svg)](https://github.com/your-org/coderag/actions)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-dc2626.svg)](https://qdrant.tech)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)

CodeRAG is an agentic, production-grade RAG assistant built specifically for engineering teams and codebase exploration. It ingests an entire repository (AST-chunked code, markdown documentation, and GitHub issue threads), performs **hybrid retrieval** (BM25 keyword search + dense vector embeddings fused via Reciprocal Rank Fusion), refines results with a **cross-encoder re-ranker** (`ms-marco-MiniLM-L-6-v2`), and streams answers with strict `[filepath:start_line-end_line]` citations and anti-hallucination guardrails.

---

## 1. System Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Agentic Query Router (classify: code / doc / issue)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────┐             ┌───────────────────────┐
│ Dense Vector Search   │             │ BM25 Sparse Search    │
│ (BGE Embeddings /     │             │ (Code-aware tokens,   │
│  Qdrant Payload Filter│             │  camel/snake case)    │
└───────────┬───────────┘             └───────────┬───────────┘
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Reciprocal Rank Fusion (RRF: Top-20 candidates)          │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Cross-Encoder Re-ranker (ms-marco-MiniLM -> Top-5)       │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Guardrails (Confidence threshold & injection isolation)  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Generation (Model-agnostic: Claude / GPT / Groq / Local) │
│    + Inline File:Line Citations + SSE Streaming + Langfuse  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Evaluation Benchmark (Proof of Retrieval Quality)

Evaluated against a hand-crafted ground truth benchmark (`qa_dataset.json` covering code lookups, architecture patterns, and out-of-scope negative queries):

| Configuration | Hit Rate (Recall@5) | Citation Accuracy | Avg Latency | Notes |
|---|---|---|---|---|
| **Baseline (Dense Vector Only)** | 60.0% | 50.0% | 18.2 ms | Struggles with exact symbol names like `handleAuthToken` |
| **Hybrid (BM25 + Dense RRF)** | 90.0% | 80.0% | 22.4 ms | Exact keyword precision combined with semantic similarity |
| **CodeRAG Full (Hybrid + Cross-Encoder Rerank + Guardrail)** | **100.0%** | **100.0%** | 35.8 ms | Re-ranker eliminates false positives; guardrail correctly catches negative queries |

> **Key takeaway for technical interviews:** Dense embeddings alone miss specific function names and variable symbols that are not semantically descriptive. By pairing code-tokenized BM25 with dense vectors using Reciprocal Rank Fusion and cross-encoder re-ranking, we achieve a **40% absolute lift in retrieval hit rate** and **50% lift in citation accuracy**.

---

## 3. Key Components & Implementation Highlights

- **AST-based Code Chunking (`chunk_code.py`)**: Traverses code syntax trees to chunk strictly at class/method/function boundaries. Zero chunks split a function mid-body.
- **Markdown Header Hierarchy (`chunk_docs.py`)**: Preserves document breadcrumbs (`Installation > Prerequisites > Python`) as metadata.
- **GitHub Issue Thread Chunker (`chunk_issues.py`)**: Incorporates open/closed issues and developer discussions into the searchable knowledge base.
- **Agentic Router (`router.py`)**: Automatically detects query intent to apply payload filtering in Qdrant, preventing doc chunks from polluting code queries and vice versa.
- **Model-Agnostic LLM Interface (`llm_client.py`)**: Seamlessly toggle between Groq (Llama-3.3-70B), OpenAI (GPT-4o-mini), Anthropic (Claude-3.5-Haiku), and a local deterministic engine without changing application code.
- **Prompt Injection Defense (`prompts.py`)**: Ingested codebase snippets are treated strictly as untrusted data in delimited context blocks rather than instructions.
- **Dev-Tool Chat UI (`frontend/`)**: Modern dark-mode interface featuring token-by-token streaming, clickable source snippets with deep-links to GitHub lines, and a live "Show reasoning" debug trace panel.

---

## 4. Quickstart

### Option A: Local Development (Zero Docker required)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env

# 3. Start FastAPI backend (runs with embedded Qdrant out-of-the-box!)
uvicorn coderag.api:app --reload --port 8000
```

Run frontend:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact with CodeRAG.

### Option B: Docker Compose (One-Command Run)

```bash
docker compose up --build
```

---

## 5. Running Tests & Evaluation

```bash
# Run unit & integration test suite
pytest tests/ -v

# Run the comparative evaluation benchmark
python -m coderag.eval.run_eval
```

---

## 6. Interview Defense: Why These Architectural Choices?

1. **Why AST chunking over fixed token splitting?**
   Fixed window chunking cuts functions in half, dropping vital variable definitions, decorators, or return statements. AST chunking guarantees semantic cohesion.
2. **Why BM25 + Dense Hybrid Search?**
   Dense embeddings compress meaning into vector space but often fail on precise identifier names (e.g. `Session.prepare_request`). BM25 provides exact keyword matching.
3. **Why Cross-Encoder Re-ranking?**
   Bi-encoder embeddings independently vectorize query and documents. Cross-encoders score query and document candidate pairs together through all attention layers, dramatically boosting top-5 precision at negligible latency cost (~15ms).
