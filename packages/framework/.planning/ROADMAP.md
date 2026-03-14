# Roadmap: Vibes Agent Framework Docs Parity

## Overview

Rewrite and expand the Vibes Agent Framework documentation to full parity with pydantic-ai's teaching quality. Six phases deliver the docs progressively: landing and onboarding first, then core concepts in two waves, integrations, runnable examples, and finally advanced topics with navigation cleanup. Every phase produces pages a developer can read and verify immediately.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Landing and Getting Started** - First-impression pages: hero landing, introduction, install, and progressive hello-world tutorial (completed 2026-03-14)
- [ ] **Phase 2: Core Concepts Part 1** - Agent fundamentals: agents, models, dependencies, tools, toolsets, results, messages, streaming
- [ ] **Phase 3: Core Concepts Part 2** - Advanced patterns: human-in-the-loop, testing, debugging, multi-agent, graph, thinking
- [ ] **Phase 4: Integrations** - Protocol and platform pages: MCP client/server, AG-UI, A2A, Temporal, Vercel AI UI
- [ ] **Phase 5: Examples** - Nine runnable, copy-paste examples covering every major feature
- [ ] **Phase 6: Advanced Topics, Meta, and Navigation** - Multimodal, error handling, direct model requests, project pages, nav restructure, link audit, diagram count

## Phase Details

### Phase 1: Landing and Getting Started
**Goal**: A developer landing on the docs understands what Vibes is, why it exists, and can run their first agent in under 5 minutes
**Depends on**: Nothing (first phase)
**Requirements**: LAND-01, LAND-02, GS-01, GS-02
**Success Criteria** (what must be TRUE):
  1. index.mdx opens with a benefits-first hero section, a rendered Mermaid architecture diagram, and an acknowledgments blurb
  2. An introduction page exists explaining design philosophy and crediting pydantic-ai and Vercel AI SDK
  3. The install page lists all supported providers with a Mermaid provider architecture diagram
  4. A single progressive hello-world tutorial walks from bare agent through tools, structured output, and testing -- replacing the 4 fragmented getting-started pages
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Rewrite landing page (index.mdx) and create introduction.mdx
- [ ] 01-02-PLAN.md — Enhance install page, create hello-world tutorial, delete old pages, update docs.json

### Phase 2: Core Concepts Part 1
**Goal**: Developers can learn the eight foundational concepts (agents, models, deps, tools, toolsets, results, messages, streaming) through deep-dive pages with Mermaid diagrams and working code
**Depends on**: Phase 1
**Requirements**: CONCEPT-01, CONCEPT-02, CONCEPT-03, CONCEPT-04, CONCEPT-05, CONCEPT-06, CONCEPT-07, CONCEPT-08
**Success Criteria** (what must be TRUE):
  1. Each of the 8 concept pages exists with a teaching narrative (not just API reference), at least one Mermaid diagram, and code examples that match actual mod.ts exports
  2. The Models page covers the Vercel AI SDK model layer and includes quickstart snippets for Anthropic, OpenAI, Google, Groq, Mistral, Ollama, and OpenAI-compatible providers
  3. The Tools page documents all tool types (tool, plainTool, outputTool, fromSchema) with an execution pipeline diagram
  4. The Streaming page covers both stream() and runStreamEvents() with an event timeline sequence diagram
  5. The Dependencies page positions RunContext DI as a signature feature with a fan-out diagram showing deps flowing through tools, prompts, validators, and toolsets
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Create agents.mdx, models.mdx, dependencies.mdx, tools.mdx (CONCEPT-01 through 04)
- [ ] 02-02-PLAN.md — Create toolsets.mdx, results.mdx, messages.mdx, streaming.mdx + update docs.json (CONCEPT-05 through 08)

### Phase 3: Core Concepts Part 2
**Goal**: Developers can learn the six advanced concept patterns (HITL, testing, debugging, multi-agent, graph, thinking) through dedicated pages with diagrams and real code
**Depends on**: Phase 2
**Requirements**: CONCEPT-09, CONCEPT-10, CONCEPT-11, CONCEPT-12, CONCEPT-13, CONCEPT-14
**Success Criteria** (what must be TRUE):
  1. The Human-in-the-Loop page documents requiresApproval, DeferredToolRequests, DeferredToolResults, and agent.resume() with an approval sequence Mermaid diagram
  2. The Testing page shows TestModel, FunctionModel, captureRunMessages, and agent.override() with runnable test code examples
  3. The Graph page uses the corrected API (constructor + free functions, not this.next()), includes an FSM Mermaid diagram, and documents persistence
  4. The Thinking page documents extended reasoning configuration for both Anthropic and Google models
  5. The Multi-Agent page shows agent-as-tool pattern with a delegation flow sequence diagram
**Plans**: 2 plans

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Integrations
**Goal**: Developers can integrate Vibes agents with MCP, AG-UI, A2A, Temporal, and Vercel AI UI through dedicated pages with architecture diagrams and correct APIs
**Depends on**: Phase 2
**Requirements**: INT-01a, INT-01b, INT-02, INT-03, INT-04, INT-05
**Success Criteria** (what must be TRUE):
  1. MCP is split into two pages: client (MCPToolset, MCPStdioClient, MCPHttpClient, MCPManager) and server (exposing agent as MCP server), each with architecture diagrams
  2. The AG-UI page uses the corrected API (deps/getState, not depsFactory) and includes an SSE event sequence diagram
  3. The A2A page exists as a brand-new page covering A2AAdapter, AgentCard, all JSON-RPC endpoints, task lifecycle, streaming, and a task state machine Mermaid diagram
  4. The Temporal page is rewritten with a durable execution overview and workflow-activities Mermaid diagram
  5. A new Vercel AI UI page documents connecting Vibes agent streams to useChat and useCompletion React hooks
**Plans**: 2 plans

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Examples
**Goal**: Developers can find and copy-paste nine runnable examples covering the full feature surface, from hello-world to A2A
**Depends on**: Phase 3, Phase 4
**Requirements**: EX-01, EX-02, EX-03, EX-04, EX-05, EX-06, EX-07, EX-08, EX-09
**Success Criteria** (what must be TRUE):
  1. An examples landing page exists with categorized links to all 9 examples
  2. Each example page contains a complete, copy-paste runnable program (not just snippets) with imports, setup, and execution instructions
  3. The Bank Support example faithfully ports the canonical pydantic-ai teaching example to TypeScript using Vibes APIs
  4. The Graph Workflow and Human-in-the-Loop examples demonstrate end-to-end flows matching their concept page teachings
  5. The A2A example shows two agents communicating via the A2A protocol
**Plans**: 2 plans

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Advanced Topics, Meta, and Navigation
**Goal**: The documentation is complete: advanced topics filled in, project pages published, navigation restructured to match pydantic-ai's flow, all old pages removed, zero broken links, and 30+ Mermaid diagrams across the site
**Depends on**: Phase 5
**Requirements**: ADV-01, ADV-02, ADV-03, META-01, META-02, META-03, NAV-01, NAV-02, NAV-03, NAV-04, DIAG-01
**Success Criteria** (what must be TRUE):
  1. The Multimodal page covers images, audio, video, and documents with examples for each modality
  2. The Error Handling page includes a full error taxonomy Mermaid diagram and recovery patterns per error type
  3. docs.json navigation matches the new structure: landing, intro, getting started, concepts, integrations, examples, advanced, meta
  4. All old fragmented reference pages are deleted and zero broken internal links remain (verified by audit)
  5. At least 30 Mermaid diagrams render correctly across concept and integration pages
**Plans**: 2 plans

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phases 3 and 4 both depend on Phase 2 and could run in parallel, but sequential is fine for a solo workflow.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Landing and Getting Started | 3/3 | Complete   | 2026-03-14 |
| 2. Core Concepts Part 1 | 1/2 | In Progress|  |
| 3. Core Concepts Part 2 | 0/2 | Not started | - |
| 4. Integrations | 0/2 | Not started | - |
| 5. Examples | 0/3 | Not started | - |
| 6. Advanced Topics, Meta, and Navigation | 0/3 | Not started | - |
