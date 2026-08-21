# Feature Ticket List — CodeRAG

Organized as epics matching the 6-week build plan. Copy straight into GitHub Projects/Issues — having real tickets (not just a README checklist) is itself a portfolio signal.

---

## Epic 1: Ingestion (Week 1)

**CR-1 — Repo cloning**
Clone target repo via GitHub API/git, capture commit SHA.
*AC:* Given a repo URL, the pipeline clones it locally and records the current commit SHA in metadata.

**CR-2 — AST-based code chunking**
Parse code files with tree-sitter, chunk at function/class boundaries.
*AC:* Each chunk contains `{file_path, start_line, end_line, symbol_name, docstring, language}`; no chunk splits a function mid-body.

**CR-3 — Markdown/docs chunking**
Split docs by header hierarchy, preserve heading path.
*AC:* Each doc chunk retains its H1/H2/H3 lineage as metadata.

**CR-4 — Issue ingestion**
Pull issues + comment threads via GitHub API.
*AC:* Each issue chunked with `{issue_number, state, labels, url}`; closed and open issues both included.

**CR-5 — Embedding + Qdrant load**
Embed all chunks (BGE) and load into Qdrant with `type` payload filter.
*AC:* Collection queryable, filterable by `type: code|doc|issue`.

---

## Epic 2: Retrieval (Week 2)

**CR-6 — BM25 sparse search**
Implement keyword search over chunk text.
*AC:* Returns ranked results for exact-symbol-name queries (e.g. function names) with high precision.

**CR-7 — Dense vector search**
Query Qdrant with embedded user query.
*AC:* Returns top-k semantically similar chunks.

**CR-8 — Hybrid fusion**
Combine BM25 + dense results via reciprocal rank fusion.
*AC:* Fused ranking outperforms either method alone on 5 manually spot-checked queries.

**CR-9 — Raw retrieval endpoint**
FastAPI endpoint returning retrieved chunks (no generation yet), for manual testing.
*AC:* `POST /retrieve` returns top-k chunks with scores for a given query.

---

## Epic 3: Generation & guardrails (Week 3)

**CR-10 — LLM client abstraction**
Model-agnostic `generate()` wrapper supporting Claude/GPT/Groq.
*AC:* Swapping model is a config change, no code change elsewhere.

**CR-11 — Cited generation**
Prompt enforces citation of file:line for every claim.
*AC:* On eval sample, ≥90% of answers include at least one valid citation.

**CR-12 — "Not found" guardrail**
If retrieval confidence is below threshold, skip generation and return a fixed "not found in this codebase" response.
*AC:* On a set of deliberately out-of-scope questions, system correctly declines rather than hallucinating.

**CR-13 — Hand-written eval dataset**
Write 30–50 Q&A pairs with expected source file(s), before looking at current system output.
*AC:* Dataset committed as `qa_dataset.json`, covers code/doc/issue question types.

---

## Epic 4: Evaluation (Week 4)

**CR-14 — RAGAS harness**
Wire up faithfulness, answer relevancy, context precision/recall against the eval dataset.
*AC:* `run_ragas.py` outputs a metrics report.

**CR-15 — Baseline eval run**
Run eval before re-ranking is added; record scores.
*AC:* Baseline metrics table saved/committed.

**CR-16 — Cross-encoder re-ranking**
Add re-ranker between retrieval and generation.
*AC:* Re-ranked eval run shows measurable change vs. baseline (documented either way — improvement or trade-off).

**CR-17 — Custom citation-accuracy metric**
Compare cited file against expected file from the eval dataset.
*AC:* Metric reported alongside RAGAS scores.

---

## Epic 5: Agentic layer & observability (Week 5)

**CR-18 — Query router**
Classify query as code/doc/issue/mixed, apply payload filter before retrieval.
*AC:* On eval set, routing correctly narrows scope for ≥90% of clearly-typed questions.

**CR-19 — Model fallback + comparison**
Add Groq/open-source path, run same eval set against both models.
*AC:* Cost/latency/quality comparison table produced.

**CR-20 — Langfuse tracing**
Instrument every request (chunks retrieved, scores, model, latency, tokens).
*AC:* Trace visible in Langfuse dashboard for any given query.

---

## Epic 6: Ship (Week 6)

**CR-21 — Frontend chat UI**
Streaming chat interface with sources panel (per Frontend Spec).
*AC:* User can ask a question and see a streamed, cited answer with expandable sources.

**CR-22 — Trace/debug view**
Toggle showing routing decision, scores, latency in the UI.
*AC:* Visible and accurate for any completed query.

**CR-23 — Dockerization**
`docker-compose.yml` running API + Qdrant with one command.
*AC:* `docker compose up` gets a fresh clone running locally with no manual steps beyond setting `.env`.

**CR-24 — Deployment**
Deploy API+Qdrant (Render/Railway) and frontend (Vercel).
*AC:* Public live URL works end-to-end with no local setup required.

**CR-25 — README + docs**
Architecture diagram, eval metrics table, demo GIF, plain-English explanation of design decisions.
*AC:* A reader unfamiliar with the project can understand what it does and why in under 2 minutes.

**CR-26 — CI eval workflow**
GitHub Action running the eval suite on push.
*AC:* PRs show eval results as a check, not just pass/fail tests.

---

## Priority note

If time runs short, CR-1 through CR-17 (Epics 1–4) form a complete, defensible MVP on their own. CR-18–26 are the differentiators — build them if the timeline allows, but don't sacrifice eval quality (Epic 4) to rush there.
