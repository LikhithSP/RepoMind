# Security & Access Document — CodeRAG

Even as a solo portfolio project, documenting this shows security-mindedness in an interview — most fresher projects have none of this.

## 1. Secrets management

- All API keys (LLM providers, GitHub token, Qdrant if cloud-hosted) live in environment variables, never committed
- `.env` in `.gitignore`; `.env.example` committed with placeholder keys so the repo is runnable by others
- Production secrets (Render/Railway/Vercel) set via the platform's secret manager, not baked into the Docker image
- GitHub Actions CI secrets stored in repo Settings → Secrets, referenced via `${{ secrets.X }}`, never printed to logs

## 2. GitHub access scope

- The token used by `clone_repo.py` / issue ingestion is **read-only**, scoped to `public_repo` (or fine-grained read-only access to the specific repo) — least privilege, since this tool never needs write access
- No use of a personal token with broad `repo` scope

## 3. Prompt injection defense

- Ingested content (issues, docs, even code comments) is untrusted text that could contain instructions aimed at the LLM ("ignore previous instructions...")
- Mitigation: system prompt explicitly instructs the model to treat retrieved chunks as **data, not instructions**; user-facing answer generation never executes or follows directives found inside retrieved content
- Chunks are wrapped in clearly delimited context blocks (not concatenated as if part of the system prompt) to reduce injection surface

## 4. Input handling (API layer)

- Query length capped (e.g. 2,000 chars) to prevent abuse/cost blowup
- Basic rate limiting on `/query` (e.g. per-IP, via FastAPI middleware or a reverse-proxy rule) since the demo is public
- `/reindex` endpoint protected with a simple API key header — this one *is* a write-ish operation (triggers re-ingestion) and shouldn't be publicly triggerable

## 5. Data handling

- No user accounts in MVP — no PII is collected
- Query logs (via Langfuse) are for the builder's own debugging/eval only; if the demo is public, the README states queries may be logged for improving the system
- No sensitive data expected in the target repo's public content, but the pipeline never sends anything beyond retrieved chunks + query to the LLM — no full-repo dumping into a single mega-prompt

## 6. Infrastructure

- Docker containers run as a non-root user
- Qdrant instance not exposed publicly — only the FastAPI backend is internet-facing; Qdrant sits on the internal Docker network
- CORS restricted to the deployed frontend's origin, not `*`
- Dependencies pinned in `requirements.txt` / lockfile; Dependabot (or `pip-audit`) enabled on the repo for vulnerability alerts

## 7. LLM output handling

- Generated answers are rendered as text/markdown in the frontend, not `dangerouslySetInnerHTML`-style raw HTML injection — avoids XSS via model output
- No generated code from the assistant is ever auto-executed

## 8. What's explicitly deferred (documented, not hidden)

- No auth/RBAC — fine for a single-tenant demo, would be required before any multi-user or internal-company use
- No encryption-at-rest configuration beyond the hosting platform's defaults — acceptable for public OSS repo content, would need review before pointing this at private/proprietary code
