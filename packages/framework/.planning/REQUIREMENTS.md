# Requirements: Vibes Agent Framework Docs Parity

**Defined:** 2026-03-14
**Core Value:** Every developer who lands on the docs can understand Vibes, why it exists, and ship their first agent in under 5 minutes.

## v1 Requirements

### Landing & Introduction

- [x] **LAND-01**: Landing page (index.mdx) opens with benefits-first hero section, Mermaid architecture diagram, and pydantic-ai/Vercel AI SDK acknowledgment blurb — mirrors pydantic-ai's opening style
- [x] **LAND-02**: Introduction page created explaining design philosophy and "Standing on the Shoulders of Giants" section explicitly crediting pydantic-ai and Vercel AI SDK

### Getting Started

- [x] **GS-01**: Install page enhanced with supported provider list and Mermaid provider architecture diagram
- [x] **GS-02**: Single progressive hello-world tutorial that builds ONE example from scratch: bare agent → add tools → add structured output → test it (replaces 4 fragmented pages: first-agent, adding-tools, structured-output, testing)

### Concepts

- [ ] **CONCEPT-01**: Agents page — Agent class deep dive, constructor options, type params `<TDeps,TOutput>`, system prompts, instructions, `agent.override()`, full agent loop Mermaid flowchart
- [ ] **CONCEPT-02**: Models page — Vercel AI SDK model layer explanation, quickstarts for Anthropic/OpenAI/Google/Groq/Mistral/Ollama/OpenAI-compatible, ModelSettings
- [ ] **CONCEPT-03**: Dependencies page — RunContext DI as signature feature, fan-out diagram showing deps flowing through tools/prompts/validators/toolsets, testing with fake deps
- [ ] **CONCEPT-04**: Tools page — `tool()`, `plainTool()`, `outputTool()`, `fromSchema()`, `prepare`, `argsValidator`, `requiresApproval`, `sequential`, multi-modal returns, execution pipeline Mermaid diagram
- [ ] **CONCEPT-05**: Toolsets page — all toolset types with composition diagram and per-turn resolution sequence diagram
- [ ] **CONCEPT-06**: Results page — `outputSchema`, union types, output modes (tool/native/prompted) comparison Mermaid diagram, result validators, retry flow
- [ ] **CONCEPT-07**: Messages and Chat History page — `result.messages`, `result.newMessages`, `messageHistory`, all 4 history processors, `serializeMessages`/`deserializeMessages`, multi-turn sequence diagram
- [ ] **CONCEPT-08**: Streaming page — `agent.stream()`, `agent.runStreamEvents()`, `textStream`, `partialOutput`, event types, when to use each, event timeline sequence diagram
- [ ] **CONCEPT-09**: Human-in-the-Loop page — `requiresApproval`, `ApprovalRequiredError`, `DeferredToolRequests`, `DeferredToolResults`, `agent.resume()`, `ExternalToolset`, approval sequence Mermaid diagram
- [ ] **CONCEPT-10**: Testing page — `TestModel`, `createTestModel()`, `FunctionModel`, `setAllowModelRequests(false)`, `captureRunMessages()`, `agent.override()`, real test code examples
- [ ] **CONCEPT-11**: Debugging and Monitoring page — `instrumentAgent()`, `TelemetrySettings`, OTel span hierarchy Mermaid diagram, content exclusion
- [ ] **CONCEPT-12**: Multi-Agent page — agent-as-tool pattern, usage aggregation, programmatic handoff, agent delegation sequence diagram
- [ ] **CONCEPT-13**: Graph page — `BaseNode`, `Graph`, `GraphRun`, fixed API (constructor + free functions), `toMermaid()`, `runIter()`, `FileStatePersistence`, FSM Mermaid diagram
- [ ] **CONCEPT-14**: Thinking page — extended reasoning config for Anthropic (`thinking.budgetTokens`) and Google models

### Integrations

- [ ] **INT-01a**: MCP Client page — `MCPToolset`, `MCPStdioClient`, `MCPHttpClient`, `MCPManager`, `loadMCPConfig`, architecture diagram
- [ ] **INT-01b**: MCP Server page — exposing a Vibes agent as an MCP server (new capability docs)
- [ ] **INT-02**: AG-UI page — fixed API (`deps`/`getState` not `depsFactory`), `AGUIAdapter.handleRequest()`, SSE event sequence diagram
- [ ] **INT-03**: A2A page — brand new, full coverage: `A2AAdapter`, AgentCard at `/.well-known/agent.json`, `tasks/send`, `tasks/sendSubscribe`, `tasks/get`, `tasks/cancel`, task state machine Mermaid diagram, `MemoryTaskStore`
- [ ] **INT-04**: Temporal page — rewrite with durable execution overview, `TemporalAgent`, `MockTemporalAgent`, workflow-activities Mermaid diagram
- [ ] **INT-05**: Vercel AI UI page — new page connecting Vibes agent stream to `useChat`/`useCompletion` React hooks

### Examples

- [ ] **EX-01**: Examples landing page with categorized links to all examples
- [ ] **EX-02**: Hello world example — simplest possible agent (5 lines, copy-paste runnable)
- [ ] **EX-03**: Weather agent example — tools + external API + structured output (the canonical "first real agent")
- [ ] **EX-04**: Chat app example — multi-turn conversation with history + Vercel AI frontend integration
- [ ] **EX-05**: Bank support example — pydantic-ai's canonical teaching example ported to TypeScript
- [ ] **EX-06**: RAG example — retrieval-augmented generation with tools + vector search pattern
- [ ] **EX-07**: Graph workflow example — multi-step FSM pipeline using BaseNode/Graph
- [ ] **EX-08**: Human-in-the-loop example — end-to-end deferred approval flow
- [ ] **EX-09**: A2A example — two agents communicating via A2A protocol

### Advanced Topics

- [ ] **ADV-01**: Multimodal page — rewrite/expand to cover images, audio, video, documents with examples
- [ ] **ADV-02**: Error handling page — rewrite with full error taxonomy Mermaid diagram and recovery patterns per error type
- [ ] **ADV-03**: Direct model requests page — calling model directly without agent wrapper

### Project & Meta

- [ ] **META-01**: Acknowledgments page — dedicated thank-you to pydantic-ai (Samuel Colvin / Pydantic team) and Vercel AI SDK with context on how Vibes relates to each
- [ ] **META-02**: Contributing page — how to contribute to the framework
- [ ] **META-03**: Changelog page — version history

### Navigation & Quality

- [ ] **NAV-01**: `docs.json` navigation restructured to match new pydantic-ai-inspired nav (landing → intro → getting started → concepts → integrations → examples → advanced → meta)
- [ ] **NAV-02**: All old fragmented reference pages deleted (getting-started/first-agent, adding-tools, structured-output, testing, concepts/how-agents-work, concepts/dependency-injection, concepts/error-handling, guides/*, reference/core/*, reference/advanced/*, reference/integrations/*)
- [ ] **NAV-03**: Zero broken internal links — every link in every MDX file resolves to an existing page in `docs.json`
- [ ] **NAV-04**: features.mdx (reference/features) updated to link to new page locations
- [ ] **DIAG-01**: Minimum 30 Mermaid diagrams rendered across concept and integration pages

## v2 Requirements

- Per-provider deep-dive pages (OpenAI, Anthropic, Google each get their own full page)
- Evals section — after eval feature lands in framework
- TypeDoc auto-generated API reference
- Video tutorials embedded in getting-started pages
- Dark/light Mermaid diagram theming

## Out of Scope

| Feature | Reason |
|---|---|
| Evals section | Framework eval support doesn't exist yet — docs without code is misleading |
| DBOS / Prefect durable execution | Not implemented in framework by design |
| Auto-generated API reference (TypeDoc) | Manual reference pages sufficient for now |
| Migration from v1 Python Vibes | Different project, out of scope for framework docs |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| LAND-01 | Phase 1 | Pending |
| LAND-02 | Phase 1 | Pending |
| GS-01 | Phase 1 | Complete |
| GS-02 | Phase 1 | Complete |
| CONCEPT-01 | Phase 2 | Pending |
| CONCEPT-02 | Phase 2 | Pending |
| CONCEPT-03 | Phase 2 | Pending |
| CONCEPT-04 | Phase 2 | Pending |
| CONCEPT-05 | Phase 2 | Pending |
| CONCEPT-06 | Phase 2 | Pending |
| CONCEPT-07 | Phase 2 | Pending |
| CONCEPT-08 | Phase 2 | Pending |
| CONCEPT-09 | Phase 3 | Pending |
| CONCEPT-10 | Phase 3 | Pending |
| CONCEPT-11 | Phase 3 | Pending |
| CONCEPT-12 | Phase 3 | Pending |
| CONCEPT-13 | Phase 3 | Pending |
| CONCEPT-14 | Phase 3 | Pending |
| INT-01a | Phase 4 | Pending |
| INT-01b | Phase 4 | Pending |
| INT-02 | Phase 4 | Pending |
| INT-03 | Phase 4 | Pending |
| INT-04 | Phase 4 | Pending |
| INT-05 | Phase 4 | Pending |
| EX-01 | Phase 5 | Pending |
| EX-02 | Phase 5 | Pending |
| EX-03 | Phase 5 | Pending |
| EX-04 | Phase 5 | Pending |
| EX-05 | Phase 5 | Pending |
| EX-06 | Phase 5 | Pending |
| EX-07 | Phase 5 | Pending |
| EX-08 | Phase 5 | Pending |
| EX-09 | Phase 5 | Pending |
| ADV-01 | Phase 6 | Pending |
| ADV-02 | Phase 6 | Pending |
| ADV-03 | Phase 6 | Pending |
| META-01 | Phase 6 | Pending |
| META-02 | Phase 6 | Pending |
| META-03 | Phase 6 | Pending |
| NAV-01 | Phase 6 | Pending |
| NAV-02 | Phase 6 | Pending |
| NAV-03 | Phase 6 | Pending |
| NAV-04 | Phase 6 | Pending |
| DIAG-01 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*
