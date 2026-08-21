# Technical Architecture Document — CodeRAG

## 1. System overview

```
                     ┌────────────────────────────────────────┐
                     │              Ingestion                 │
                     │  clone_repo -> chunk_code/docs/issues   │
                     │            -> embed -> Qdrant           │
                     └────────────────────────────────────────┘
                                        │
 User query ──> Router (classify) ──> Hybrid Search (BM25 + dense, RRF)
                                        │
                                 Cross-encoder Re-rank
                                        │
                                Generation (LLM + citations)
                                        │
                              Guardrail (grounded? else "not found")
                                        │
                         Response (streamed) + Langfuse trace
```

## 2. Components

### 2.1 Ingestion pipeline
- `clone_repo.py`: pulls target repo via GitHub API/git clone, shallow clone to keep it light
- `chunk_code.py`: parses code with `tree-sitter`; chunks at function/class boundaries; each chunk carries `{file_path, start_line, end_line, language, symbol_name, docstring}`
- `chunk_docs.py`: splits markdown by header hierarchy (H1/H2/H3), preserves heading path as metadata
- `chunk_issues.py`: pulls issues + comment threads via GitHub API, chunks per-issue with `{issue_number, state, labels, url}`

### 2.2 Storage
- **Qdrant** (self-hosted, Docker): one collection, payload-filtered by `type: code|doc|issue`
- Payload schema: `{text, file_path/url, start_line, end_line, type, repo_commit_sha}` — commit SHA lets you know if the index is stale relative to the repo

### 2.3 Retrieval
- `hybrid_search.py`: BM25 (`rank_bm25`) over chunk text + dense vector search (BGE embeddings) in parallel, combined via reciprocal rank fusion
- `reranker.py`: cross-encoder (`ms-marco-MiniLM-L-6-v2`) re-scores top-k (e.g. top 20 → top 5) before generation
- `router.py`: lightweight classification (small LLM call or a simple keyword/embedding classifier) that tags the query as code / doc / issue / mixed, and applies a payload filter accordingly before hybrid search runs

### 2.4 Generation
- `llm_client.py`: single interface (`generate(prompt, model="claude-haiku"|"gpt-4o-mini"|"groq-llama")`) so the model is a config value, not hardcoded — enables the cost/latency/quality comparison in the PRD
- `prompts.py`: system prompt enforces "answer only from provided context, cite file:line for every claim, say 'not found in this codebase' if the context doesn't support an answer"

### 2.5 Evaluation
- `qa_dataset.json`: 30–50 hand-written Q&A pairs with expected source file(s)
- `run_ragas.py`: computes faithfulness, answer relevancy, context precision, context recall
- `custom_metrics.py`: "citation accuracy" — did the returned source match the expected file/function

### 2.6 Observability
- Langfuse wraps every request: retrieved chunks, re-ranking scores, model used, latency, token cost — gives you a real trace to show in a demo, not just a chat transcript

### 2.7 API
- FastAPI, single primary endpoint `POST /query` (SSE streaming), plus `GET /health` and `POST /reindex` (manual trigger, MVP has no auto-sync)

### 2.8 Frontend
- See Frontend Spec Document

## 3. Data flow (single query)

1. Frontend sends query to `/query`
2. Router classifies intent, sets payload filter
3. Hybrid search retrieves top-20 candidates from Qdrant
4. Re-ranker narrows to top-5
5. Guardrail check: if top-5 relevance scores are all below threshold → return "not found," skip generation
6. Otherwise, prompt assembled with the 5 chunks, sent to LLM, streamed back
7. Langfuse logs the full trace async (non-blocking)

## 4. Why these choices (for interview defense)

- **AST chunking over fixed-size splitting:** fixed-size chunks cut functions mid-body, destroying retrieval precision for code
- **Hybrid over pure dense:** exact symbol/function names (e.g. `handleAuthToken`) are often better matched by keyword search than embeddings
- **Re-ranking:** cheap relative to the precision gain — first-stage retrieval optimizes for recall, re-ranking optimizes for precision
- **Router:** codebase questions and issue questions need different retrieval scopes; without routing, doc chunks pollute code answers and vice versa
- **Model-agnostic client:** avoids vendor lock-in in the design and lets you produce a real comparison table instead of asserting one model is "best"

## 5. Extensibility (not built in MVP, but designed for)

- Multi-repo support: add `repo_id` to payload, filter per-session
- Auto re-index on webhook/push
- Auth layer if made multi-user (see Security & Access Document)
