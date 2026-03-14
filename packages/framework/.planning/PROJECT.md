# Vibes Agent Framework — Documentation Parity

## What This Is

Complete rewrite and expansion of the Vibes Agent Framework documentation to full parity with pydantic-ai's documentation. The goal is to teach people to use `@vibes/framework` the same way pydantic-ai teaches its users — with a progressive teaching flow, benefits shown upfront, Mermaid diagrams throughout, working code examples, and no broken links. The docs use Mintlify (MDX) and the full content plan is captured in `docs_parity.md`.

## Core Value

Every developer who lands on the docs should be able to understand what Vibes is, why it exists, and ship their first agent in under 5 minutes — the same experience pydantic-ai delivers.

## Requirements

### Validated

- ✓ Framework source code exists and is stable — `lib/`, `mod.ts`
- ✓ Mintlify docs infrastructure in place — `docs/`, `docs/docs.json`
- ✓ docs_parity.md gap analysis complete — 2 ✅, 31 ⚠️, 47 ❌ items tracked
- ✓ Codebase mapped — `.planning/codebase/`

### Active

- [ ] **LAND-01**: Landing page (index.mdx) rewritten with benefits-first hero, Mermaid architecture diagram, and acknowledgments blurb
- [ ] **LAND-02**: Introduction page created with design philosophy and "Standing on the Shoulders of Giants" (pydantic-ai + Vercel AI SDK)
- [ ] **GS-01**: Getting Started install page enhanced with provider list and architecture diagram
- [ ] **GS-02**: Single progressive hello-world tutorial (replaces 4 fragmented getting-started pages)
- [ ] **CONCEPT-01**: Agents concept page — deep dive with full agent loop Mermaid diagram
- [ ] **CONCEPT-02**: Models concept page — Vercel AI SDK model layer + all provider quickstarts
- [ ] **CONCEPT-03**: Dependencies concept page — RunContext DI as signature feature with fan-out diagram
- [ ] **CONCEPT-04**: Tools concept page — all tool types + execution pipeline diagram
- [ ] **CONCEPT-05**: Toolsets concept page — composition diagram + per-turn resolution
- [ ] **CONCEPT-06**: Results concept page — output modes comparison + validation flow
- [ ] **CONCEPT-07**: Messages and chat history — multi-turn + history processors + serialization
- [ ] **CONCEPT-08**: Streaming concept page — stream() + runStreamEvents() + event timeline
- [ ] **CONCEPT-09**: Human-in-the-loop concept page — approval sequence + resume() flow
- [ ] **CONCEPT-10**: Testing concept page — TestModel, FunctionModel, captureRunMessages
- [ ] **CONCEPT-11**: Debugging and monitoring — OTel span hierarchy diagram
- [ ] **CONCEPT-12**: Multi-agent concept page — agent-as-tool + delegation flow diagrams
- [ ] **CONCEPT-13**: Graph concept page — fix API bugs + FSM Mermaid + persistence flow
- [ ] **CONCEPT-14**: Thinking / extended reasoning — new page for Anthropic/Google thinking config
- [ ] **INT-01**: MCP integration — split into client + server pages with architecture diagrams
- [ ] **INT-02**: AG-UI integration — fix API bug + SSE event sequence diagram
- [ ] **INT-03**: A2A integration — brand new page, full protocol docs + task state machine
- [ ] **INT-04**: Temporal integration — rewrite with durable execution overview + workflow diagram
- [ ] **INT-05**: Vercel AI UI streaming — new page for useChat/useCompletion integration
- [ ] **EX-01**: Examples landing page
- [ ] **EX-02**: Hello world example (5-line agent)
- [ ] **EX-03**: Weather agent example (tools + external API + structured output)
- [ ] **EX-04**: Chat app example (multi-turn + Vercel AI frontend)
- [ ] **EX-05**: Bank support example (canonical pydantic-ai teaching example, ported to TS)
- [ ] **EX-06**: RAG example (tools + vector search)
- [ ] **EX-07**: Graph workflow example (multi-step FSM pipeline)
- [ ] **EX-08**: Human-in-the-loop example (end-to-end deferred approval)
- [ ] **EX-09**: A2A example (two agents talking via A2A)
- [ ] **ADV-01**: Multimodal concept page — images, audio, video, documents
- [ ] **ADV-02**: Error handling rewrite — full error taxonomy diagram + recovery patterns
- [ ] **ADV-03**: Direct model requests — calling model without agent
- [ ] **META-01**: Acknowledgments page — thank pydantic-ai + Vercel AI SDK
- [ ] **META-02**: Contributing page
- [ ] **META-03**: Changelog page
- [ ] **NAV-01**: docs.json navigation updated to match new structure
- [ ] **NAV-02**: All old fragmented reference pages deleted
- [ ] **NAV-03**: Zero broken internal links (verified by audit)
- [ ] **DIAG-01**: 30+ Mermaid diagrams across concept/integration pages

### Out of Scope

- Evals section — requires framework-level eval support first; defer to future milestone
- DBOS / Prefect durable execution pages — not implemented in framework, skip by design
- Auto-generated API reference (TypeDoc/tsdoc) — manual reference pages only for now
- Per-provider deep-dive pages beyond quickstarts — keep models page to overview + snippets

## Context

- Framework uses Deno + TypeScript, exports via `mod.ts`
- Mintlify for docs: MDX format, `docs/docs.json` for nav, Mermaid supported natively
- pydantic-ai docs at https://ai.pydantic.dev/ are the north star for style and pedagogy
- docs_parity.md at project root has the full priority-ordered gap analysis (P0-P5)
- Codebase map at `.planning/codebase/` — CONCERNS.md has the known API bugs to fix
- Known bugs to fix: Graph constructor API, AG-UI `depsFactory` → `deps`/`getState`, `BaseNode.this.next()` → imported `next()`
- Existing docs: 34 MDX pages, mostly reference-style — all to be restructured or replaced

## Constraints

- **Mintlify**: All docs must be valid Mintlify MDX — use their component library (Cards, CodeGroup, Tabs, etc.)
- **API accuracy**: Every code example must match actual exports from `mod.ts` — no invented APIs
- **No broken links**: Every internal link must resolve to an existing page in `docs.json`
- **Mermaid**: Use `mermaid` code fences — Mintlify renders them natively
- **Deno-first**: Code examples use Deno import style (`npm:@vibes/framework`) or JSR style

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Follow pydantic-ai nav structure | Their pedagogical flow is proven — teach same way | — Pending |
| Mintlify stays (no migration) | Already configured, 34 pages exist, no benefit to switching | ✓ Good |
| Merge fragmented getting-started into one hello-world | pydantic-ai teaches via ONE evolving example — more effective | — Pending |
| Evals deferred | Feature doesn't exist yet — docs without code is misleading | ✓ Good |
| Acknowledge pydantic-ai + Vercel AI SDK prominently | Good OSS citizenship + sets user expectations | — Pending |

---
*Last updated: 2026-03-14 after initialization*
