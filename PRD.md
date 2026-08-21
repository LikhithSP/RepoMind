# Product Requirements Document — CodeRAG

**Product:** Agentic RAG Assistant for Codebases
**Owner:** Eren
**Status:** MVP — Weeks 1–6 build
**Doc type:** PRD (living in `/docs` in the repo — itself a portfolio signal)

---

## 1. Problem

Engineers joining a new codebase (or an OSS contributor, or a fresher on their first project) burn days navigating unfamiliar code, docs, and stale/scattered issue threads. Generic search (grep, GitHub search) finds text matches, not answers. Generic LLM chat has no grounding in the actual repo and hallucinates APIs that don't exist.

## 2. Goal

Build a RAG system that answers natural-language engineering questions about a real codebase — code, docs, and issues — with citations to exact files/lines, and that is **measurably** more accurate than naive RAG (proven via eval, not vibes). Secondary goal: produce a project that demonstrates production RAG engineering (retrieval quality, evaluation, observability) for AI Engineer job applications.

## 3. Target users

- **Primary (for the demo):** a developer new to the target repo, asking "how does X work" / "where should I add Y."
- **Primary (for the resume):** technical interviewers/recruiters assessing whether the candidate can build production-grade AI systems, not just a tutorial project.

## 4. Scope — MVP (in)

- Ingest one real GitHub repo: code (AST-chunked), docs (header-chunked), issues (thread-chunked)
- Hybrid retrieval (BM25 + dense) with reciprocal rank fusion
- Cross-encoder re-ranking
- Query router: classify question → code / doc / issue path
- Cited, source-grounded answers with a "not found" fallback (no hallucinated APIs)
- Model-agnostic generation (hosted + open-source fallback)
- RAGAS evaluation harness with a hand-built Q&A set, before/after re-ranking comparison
- Request tracing (Langfuse)
- Chat UI with visible source snippets
- Dockerized, deployed with a live public demo link

## 5. Out of scope (v1)

- Multi-repo / cross-repo search
- Write access (auto-generating PRs, code edits)
- Auth / multi-tenant accounts
- Real-time repo sync (webhook-triggered re-indexing) — manual re-ingest only
- Fine-tuning any model

## 6. User stories

1. As a new contributor, I ask "how is auth handled in this repo" and get an answer citing the exact middleware file and function.
2. As a maintainer, I ask about an open issue and get a summary of the discussion with a link to the thread.
3. As a user, if the answer isn't in the indexed content, I'm told so instead of getting a plausible-sounding wrong answer.
4. As the builder, I can compare baseline vs. re-ranked retrieval quality with a concrete metrics table.

## 7. Success metrics

- RAGAS faithfulness ≥ 0.85 on the hand-built eval set
- Measurable lift in context precision/recall after adding hybrid search + re-ranking (documented, not assumed)
- Answer includes correct source citation ≥ 90% of the time on eval set
- End-to-end query latency under ~5s on the demo deployment
- Live deployed demo with zero-setup access (no local install required to try it)

## 8. Milestones

Matches the 6-week build plan: Ingestion (Wk1) → Retrieval (Wk2) → Generation+guardrails (Wk3) → Eval (Wk4) → Agentic router+observability (Wk5) → Ship (Wk6).

## 9. Risks

- **Chunking quality** dominates retrieval quality more than model choice — budget real time here, don't rush Week 1.
- **Eval set bias** — write questions before looking at what the system currently gets right, to avoid overfitting the eval to known-good cases.
- **Cost creep** from hosted LLM calls during eval iteration — default to the open-source/Groq path during development, switch to hosted only for final demo runs.
