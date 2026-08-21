# Frontend Spec Document — CodeRAG

**Stack:** Next.js (recommended for the resume-visible version) or Streamlit (faster to ship if time-constrained) — this spec assumes Next.js; note where Streamlit simplifies things.

## 1. Screens / views

### 1.1 Main chat view (primary screen)
- Chat-style interface: message input at bottom, conversation history above
- Each assistant response streams in token-by-token (SSE)
- Below each answer: a **Sources panel** — collapsible list of the retrieved chunks actually used, each showing file path + line range, with a "view snippet" expand
- Clicking a source scrolls to / expands the exact code snippet inline (no need to leave the app)

### 1.2 Trace / debug view (toggle, interview-demo feature)
- A toggle ("Show reasoning") reveals: query classification result (code/doc/issue), retrieval scores pre- and post-re-ranking, model used, latency, token count
- This is the single highest-leverage UI feature for interviews — it turns a black-box chatbot into a visible demonstration of the pipeline

### 1.3 Settings panel (lightweight)
- Model selector dropdown: hosted (Claude/GPT-4o-mini) vs open-source (Groq/Llama) — lets you demo the model-agnostic design live
- Repo indicator: shows which repo + commit SHA is currently indexed

### 1.4 Empty / onboarding state
- On first load: short explainer + 3–4 example questions as clickable chips ("How does auth work?", "Where is rate limiting implemented?") so a recruiter can try it in one click without thinking of a question

## 2. Components

- `ChatWindow` — message list + streaming renderer
- `MessageBubble` — user vs assistant styling, markdown rendering (code blocks with syntax highlighting)
- `SourcePanel` — collapsible source list, per-message
- `SourceSnippet` — syntax-highlighted code excerpt with file path header and a "view on GitHub" link (deep link to the actual line on GitHub)
- `TraceView` — debug panel (routing decision, scores, latency)
- `ModelSelector` — dropdown, controls which backend model config is sent with the request
- `ExampleChips` — onboarding prompt suggestions

## 3. State management

- Local component state (`useState`/`useReducer`) is sufficient at this scale — no need for Redux/Zustand
- Conversation history held in memory for the session (no persistence needed for MVP; note this in the README as a deliberate scope cut, not an oversight)
- No browser storage (localStorage) needed since there's no user account layer

## 4. API integration

- `POST /query` — SSE stream; frontend appends tokens as they arrive
- Response includes a final structured payload with `sources[]` and `trace` metadata once streaming completes
- Loading state: show a "retrieving..." indicator before first token arrives (retrieval + re-ranking adds latency before generation starts — be honest about it in the UI rather than a bare spinner)

## 5. Visual direction

- Dev-tool aesthetic: monospace for code, clean neutral palette (not a generic purple-gradient SaaS template — this is a technical tool, should look like one)
- Dark mode as default (audience is developers)
- Prioritize legibility of code snippets over decorative UI — the sources panel is the feature that sells this project, don't bury it

## 6. Responsive behavior

- Desktop-first (this is a dev-tool demo, primarily viewed on laptop by recruiters/interviewers)
- Mobile: collapse the sources panel under the message by default (tap to expand) rather than a fixed sidebar

## 7. If using Streamlit instead

- `st.chat_message` for the conversation, `st.expander` per message for sources, `st.sidebar` for model selector + trace view — same information architecture, less custom styling control, but ships in a fraction of the time
