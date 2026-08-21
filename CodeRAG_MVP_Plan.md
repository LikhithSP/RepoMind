# CodeRAG — Agentic RAG Assistant for Codebases
### MVP Build Plan

An AI assistant that ingests a real GitHub repo (code + docs + issues) and answers engineering questions like "how does the auth middleware work" or "where should I add rate limiting" — with citations to exact files and line numbers. This is the closest a portfolio project gets to what an AI Engineer actually builds on the job (internal dev tooling / codebase copilots).

---

## 1. Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Ingestion  │ --> │  Hybrid Retrieval │ --> │   Generation     │
│  Pipeline   │     │  + Re-ranking     │     │   + Guardrails   │
└─────────────┘     └──────────────────┘     └─────────────────┘
      │                      │                        │
      v                      v                        v
  Qdrant (vectors)   Query Router (agentic)    Langfuse (tracing)
                                                RAGAS (eval)
```

**Flow:** clone repo → chunk code/docs/issues → embed → store in Qdrant →
user query → router classifies intent → hybrid search (BM25 + dense) →
cross-encoder re-rank → LLM generates cited answer → traced + logged.

---

## 2. Repo structure

```
coderag/
├── ingestion/
│   ├── clone_repo.py        # pulls target repo via GitHub API
│   ├── chunk_code.py        # AST-based chunking (tree-sitter or ast module)
│   ├── chunk_docs.py        # header-based markdown chunking
│   └── chunk_issues.py      # issue + comments as chunks
├── retrieval/
│   ├── hybrid_search.py     # BM25 + dense, reciprocal rank fusion
│   ├── reranker.py          # cross-encoder (ms-marco-MiniLM)
│   └── router.py            # classifies query -> code/doc/issue path
├── generation/
│   ├── prompts.py
│   └── llm_client.py        # model-agnostic wrapper (Claude/GPT/Groq)
├── eval/
│   ├── qa_dataset.json      # 30-50 hand-written Q&A pairs
│   ├── run_ragas.py
│   └── custom_metrics.py    # "did it cite the right file/function"
├── api/
│   └── main.py              # FastAPI, streaming endpoint
├── frontend/
│   └── (Next.js or Streamlit)
├── docker-compose.yml       # api + qdrant
├── .github/workflows/eval.yml
└── README.md
```

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | Standard for AI tooling |
| Chunking | `tree-sitter` (code), regex/markdown-it (docs) | Function/class-aware, not naive splitting |
| Embeddings | BAAI/bge-large-en or OpenAI text-embedding-3-small | Strong open-source option + hosted comparison |
| Vector DB | Qdrant (self-hosted, Docker) | Shows infra skill, has native hybrid search support |
| Sparse search | BM25 (`rank_bm25`) | Keyword precision for exact function/variable names |
| Re-ranker | cross-encoder/ms-marco-MiniLM-L-6-v2 | Cheap, fast, big precision boost |
| LLM | Claude Haiku or GPT-4o-mini (primary), Llama via Groq (fallback) | Model-agnostic = extra flex |
| Backend | FastAPI + SSE streaming | Async, production-grade, standard in IT hiring |
| Frontend | Streamlit (fast) or Next.js (more impressive) | Pick based on your timeline |
| Eval | RAGAS | Faithfulness, context precision/recall, answer relevancy |
| Tracing | Langfuse | Shows you think about observability, not just demos |
| Infra | Docker Compose | One-command local run |
| CI | GitHub Actions running the eval suite on push | Treats evals like unit tests — rare and impressive |
| Deploy | Render/Railway (API+Qdrant), Vercel (frontend) | Live demo link on resume |

---

## 4. Which repo to point it at

Pick a real repo that's:
- Python (or a language you're comfortable explaining)
- Medium-sized (not a 10-file toy, not the Linux kernel)
- Reasonably well-documented (has README, some docstrings, active issues)

Good candidates: something you already use (a library from your own projects), or a mid-size popular repo like `requests`, `httpx`, or a FastAPI extension. Avoid anything huge — ingestion complexity isn't the point.

---

## 5. Build plan (4–6 weeks @ 5–8 hrs/week)

**Week 1 — Ingestion**
- Clone target repo, AST-parse code into function/class-level chunks (with file path + line numbers as metadata)
- Chunk docs by markdown headers, issues as whole threads
- Embed everything, load into Qdrant with metadata filters (`type: code|doc|issue`)

**Week 2 — Retrieval**
- Implement hybrid search: BM25 + dense vector, combine with reciprocal rank fusion
- Bare FastAPI endpoint that returns raw retrieved chunks — test manually against 10-15 questions

**Week 3 — Generation**
- Add LLM generation layer with mandatory citations (file:line) in the prompt
- Add guardrail: if retrieval confidence is low, respond "not found in this codebase" instead of guessing
- Hand-write your 30-50 question eval dataset now, while the questions are fresh in your head

**Week 4 — Evaluation (this is your differentiator)**
- Wire up RAGAS, run baseline eval, record scores
- Add cross-encoder re-ranking, re-run eval, put a **before/after table** in your README
- This single table is what separates you from 95% of fresher RAG projects

**Week 5 — Agentic layer + observability**
- Build the query router (classify: code question / doc question / issue question → different retrieval filters)
- Add the Groq/open-source fallback model + a cost/latency/quality comparison
- Wire up Langfuse tracing on every request

**Week 6 — Ship it**
- Frontend polish (chat UI, source snippets with clickable file links)
- Docker Compose for one-command local run
- Deploy live (API + frontend)
- README: architecture diagram, eval table, 30-sec demo GIF, "why hybrid retrieval / why re-ranking" in plain English
- GitHub Action running eval suite on push

**If you're short on time:** Weeks 1–4 alone is already a strong, fully defensible project. Weeks 5–6 push it from "good" to "best showcase."

---

## 6. What to say in your resume line

> Built an agentic RAG system for codebase Q&A with hybrid retrieval (BM25 + dense), cross-encoder re-ranking, and a RAGAS evaluation pipeline — improved faithfulness score by X% over baseline. Model-agnostic (Claude/Groq), deployed with Docker + CI eval pipeline. [Live demo] [GitHub]

Fill in the real X% once you have your before/after numbers — a real measured number beats any adjective.
