# RepoMind — Agentic RAG Project for Codebases

[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-dc2626.svg)](https://qdrant.tech)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)

<div align="center">
  <img src="./preview%201.png" alt="RepoMind Landing Page" width="100%" />
  <br />
  <img src="./preview%202.png" alt="RepoMind Grounded Codebase Answer with Citations" width="100%" />
</div>

**RepoMind** is an agentic, production-grade **RAG Project** built specifically for engineering teams and deep codebase exploration. It ingests any public or private Git repository (parsing AST-chunked syntax trees, markdown documentation hierarchies, and GitHub issue threads), conducts **hybrid retrieval** (BM25 sparse keyword matching + BAAI/bge-small-en-v1.5 dense vector embeddings fused via Reciprocal Rank Fusion), refines candidate code chunks with a **cross-encoder re-ranker** (`ms-marco-MiniLM-L-6-v2`), and streams answers in real time with interactive citations, exact `[file:line-range]` references, and anti-hallucination guardrails.

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
│ (BGE-small-en-v1.5 /  │             │ (Code-aware tokens,   │
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

## 2. Ingestion Pipeline & Real-Time Dynamic Ingestion

RepoMind processes entire codebases into structured semantic chunks using AST parsing:

1. **AST-Based Code Chunking (`coderag/ingestion/chunk_code.py`)**:
   - Uses `ast` syntax tree traversal to chunk cleanly at class, function, and method boundaries.
   - Preserves complete function signatures, docstrings, and decorator metadata.
   - Eliminates mid-function splits and syntax breaks common in token-length splitters.
2. **Markdown Hierarchy Chunking (`coderag/ingestion/chunk_docs.py`)**:
   - Parses heading levels (`#`, `##`, `###`) to maintain contextual breadcrumbs (`Installation > Prerequisites > Python`).
3. **GitHub Issues & Threads (`coderag/ingestion/chunk_issues.py`)**:
   - Indexes open/closed GitHub issues, author discussions, and resolution comments for troubleshooting context.
4. **Real-time Ingest Modal with Server-Sent Events (SSE)**:
   - Users can ingest any GitHub repository directly from the frontend UI via the `+` button in the search bar.
   - Streams live stage progress: `Cloning Repo` → `Parsing AST` → `Building BM25` → `Embedding` → `Storing Vectors` → `Complete`.

---

## 3. Hybrid Retrieval & Re-ranking

| Stage | Component | Responsibility |
|---|---|---|
| **Query Routing** | `router.py` | Classifies intent into `code`, `doc`, or `issue` with payload filtering to prevent cross-domain pollution. |
| **Sparse Retrieval** | `bm25_search.py` | BM25 index with camelCase and snake_case code tokenization for exact variable, symbol, and function names. |
| **Dense Retrieval** | `dense_search.py` | `BAAI/bge-small-en-v1.5` embeddings stored in Qdrant (supports embedded disk storage, in-memory, or cloud). |
| **Rank Fusion** | `hybrid_search.py` | Reciprocal Rank Fusion (RRF with $k=60$) combining sparse and dense rankings into Top-20 candidates. |
| **Cross-Encoder Re-ranking** | `reranker.py` | `cross-encoder/ms-marco-MiniLM-L-6-v2` cross-attends query and code candidates to produce the final Top-5 high-precision chunks. |
| **Anti-Hallucination Guardrails** | `guardrails.py` | Evaluates cross-encoder logit confidence against a strict threshold (`-4.5`). Out-of-scope queries return a safe, graceful refusal. |

---

## 4. Evaluation Benchmark (Proof of Retrieval Quality)

Evaluated against a hand-crafted ground truth benchmark (`coderag/eval/qa_dataset.json` covering code lookups, architecture patterns, and out-of-scope negative queries):

| Configuration | Hit Rate (Recall@5) | Citation Accuracy | Avg Latency | Notes |
|---|---|---|---|---|
| **Baseline (Dense Vector Only)** | 60.0% | 50.0% | 18.2 ms | Struggles with exact symbol names like `handleAuthToken` |
| **Hybrid (BM25 + Dense RRF)** | 90.0% | 80.0% | 22.4 ms | Exact keyword precision combined with semantic similarity |
| **RepoMind Full (Hybrid + Cross-Encoder Rerank + Guardrail)** | **100.0%** | **100.0%** | 35.8 ms | Re-ranker eliminates false positives; guardrail correctly catches negative queries |

> **Key takeaway for technical interviews:** Dense embeddings alone miss specific function names and variable symbols that are not semantically descriptive. By pairing code-tokenized BM25 with dense vectors using Reciprocal Rank Fusion and cross-encoder re-ranking, we achieve a **40% absolute lift in retrieval hit rate** and **50% lift in citation accuracy**.

---

## 5. Dev-Tool Frontend UI

RepoMind features a sleek, developer-centric interface built with Next.js 14 and Vanilla CSS:
- **Instant Onboarding**: Automatically opens the ingest modal for first-time visitors so they can ingest their desired GitHub repository.
- **Dynamic Session Switching**: Ingest new repositories at any time via the search bar `+` button to start clean sessions.
- **Model Selector**: Switch effortlessly between Groq (Qwen 3.8 27B / Qwen 3.6 27B), OpenAI (GPT-4o Mini), Anthropic (Claude 3.5 Haiku), and Offline Local Assistant.
- **Live Pipeline Trace**: Inspect router classification intent, candidate retrieval counts, reranker confidence scores, and latency for every query.
- **Interactive Citations**: Clickable source cards with syntax-highlighted code snippets and deep links to GitHub file lines.
- **Theme Support**: Seamless toggle between sleek dark mode and high-contrast light mode.

---

## 6. API Reference

The FastAPI backend exposes the following REST and SSE endpoints:

- `GET /health`: Returns service health status, connected vector database status, active repository name, commit SHA, and indexed chunk count.
- `POST /query`: SSE streaming endpoint. Streams token-by-token LLM responses, followed by retrieved source snippets and pipeline trace metadata upon completion.
- `POST /retrieve`: Raw retrieval endpoint returning hybrid RRF and cross-encoder ranked candidate chunks without triggering LLM generation.
- `POST /reindex`: SSE streaming endpoint for on-demand repository cloning, AST chunking, embedding, and indexing.

---

## 7. Quickstart

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
Open `http://localhost:3000` to interact with RepoMind.

### Option B: Docker Compose (One-Command Run)

```bash
docker compose up --build
```

---

## 8. Running Tests & Evaluation

```bash
# Run unit & integration test suite
pytest tests/ -v

# Run the comparative evaluation benchmark
python -m coderag.eval.run_eval
```

---

