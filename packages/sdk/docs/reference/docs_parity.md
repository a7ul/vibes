# Docs Parity: Vibes vs Pydantic AI

> Maps every Pydantic AI left-sidebar item to our current state.
> Status: ✅ exists | ⚠️ partial/wrong | ❌ missing
> Last updated: 2026-03-15  -  after P0–P5 rewrite + package rename to `@vibesjs/sdk`

---

## Top level

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Home / Landing | `index.mdx` | ⚠️ | Rewritten with hero + arch diagram; may need polish |
| Installation | `getting-started/install.mdx` | ⚠️ | Exists; provider list coverage TBD |
| Getting Help | - | ❌ | Missing |
| Troubleshooting | - | ❌ | Missing |
| Pydantic AI Gateway | - | ❌ | Not applicable (no equivalent service) |

---

## Core concepts

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Agents | `concepts/agents.mdx` | ⚠️ | Rewritten with agent loop diagram |
| Dependencies | `concepts/dependencies.mdx` | ⚠️ | Consolidated from 3 pages; RunContext fan-out diagram added |
| Function Tools | `concepts/tools.mdx` | ⚠️ | Rewritten; verify `prepare`, `argsValidator`, `requiresApproval` coverage |
| Output (Results) | `concepts/results.mdx` | ⚠️ | Consolidated from 2 pages; output mode diagram added |
| Messages and Chat History | `concepts/messages.mdx` | ⚠️ | Rewritten; verify serialization + history processor coverage |
| Direct Model Requests | `advanced/direct-model-requests.mdx` | ⚠️ | New page  -  was ❌ |
| Streaming | `concepts/streaming.mdx` | ⚠️ | Rewritten; verify `runStreamEvents` examples |

---

## Models & Providers

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Models overview | `concepts/models.mdx` | ⚠️ | New page  -  was ❌; covers model layer + all providers |
| OpenAI | `concepts/models.mdx` (inline) | ⚠️ | No dedicated page; covered in models overview |
| Anthropic | `concepts/models.mdx` (inline) | ⚠️ | No dedicated page |
| Google (Gemini) | `concepts/models.mdx` (inline) | ⚠️ | No dedicated page |
| Groq | `concepts/models.mdx` (inline) | ⚠️ | No dedicated page |
| Mistral | `concepts/models.mdx` (inline) | ⚠️ | No dedicated page |
| Ollama (local) | `concepts/models.mdx` (inline) | ⚠️ | No dedicated page |
| OpenAI-compatible | `concepts/models.mdx` (inline) | ⚠️ | No dedicated page |
| Model Settings | `concepts/models.mdx` (likely) | ⚠️ | No dedicated page; verify coverage |
| Fallback Model | `concepts/models.mdx` (likely) | ⚠️ | No dedicated page; verify coverage |

---

## Tools & Toolsets

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Function Tools | `concepts/tools.mdx` | ⚠️ | See above |
| Advanced Tool Features | `concepts/tools.mdx` (likely) | ⚠️ | Was ❌; verify `prepare`, dynamic filtering, `sequential` coverage |
| Toolsets | `concepts/toolsets.mdx` | ⚠️ | Rewritten; verify `WrapperToolset` examples |
| Deferred Tools | `concepts/toolsets.mdx` (likely) | ⚠️ | Verify `agent.resume()` flow with sequence diagram |
| Built-in Tools | - | ❌ | Missing  -  no page listing what tools ship with the framework |
| Common Tools | - | ❌ | Missing |
| Third-Party Tools | - | ❌ | Missing |

---

## Advanced features

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Image / Audio / Video / Document Input | `advanced/multimodal.mdx` | ⚠️ | Rewritten; verify audio/video/document examples |
| Thinking (extended reasoning) | `concepts/thinking.mdx` | ⚠️ | New page  -  was ❌; covers Anthropic/Google `thinking` config |
| HTTP Request Retries | - | ❌ | Missing |
| Usage Limits | `concepts/models.mdx` (likely) | ⚠️ | No dedicated page; old `reference/advanced/usage-limits.mdx` was ✅  -  verify not lost |
| Error Handling | `advanced/error-handling.mdx` | ⚠️ | Rewritten; verify error taxonomy diagram + recovery flows |

---

## MCP (Model Context Protocol)

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| MCP Overview | `integrations/mcp-client.mdx` | ⚠️ | Dedicated page now exists |
| MCP Client | `integrations/mcp-client.mdx` | ⚠️ | MCPToolset, stdio, HTTP, MCPManager |
| FastMCP Client | `integrations/mcp-client.mdx` (likely) | ⚠️ | Was ❌; verify FastMCP coverage |
| MCP Server | `integrations/mcp-server.mdx` | ⚠️ | New page  -  was ❌; exposing agent as MCP server |

---

## Multi-Agent & Graph

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Multi-Agent Patterns | `concepts/multi-agent.mdx` | ⚠️ | Consolidated; verify delegation flow diagrams |
| Graph Overview | `concepts/graph.mdx` | ⚠️ | Rewritten; API bugs fixed |
| Graph Steps | - | ❌ | Missing  -  no dedicated steps deep-dive |
| Graph Joins & Reducers | - | ❌ | Missing |
| Graph Decisions | - | ❌ | Missing |
| Graph Parallel Execution | - | ❌ | Missing |

---

## Integrations

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Debugging & Monitoring (Logfire) | `concepts/debugging.mdx` | ⚠️ | Rewritten; verify span hierarchy diagram |
| Durable Execution Overview | `integrations/temporal.mdx` (intro) | ⚠️ | Was ❌; verify overview present in temporal page |
| Durable Execution: Temporal | `integrations/temporal.mdx` | ⚠️ | Rewritten with mermaid workflow diagram |
| Durable Execution: DBOS | - | ❌ | Missing |
| Durable Execution: Prefect | - | ❌ | Missing |
| UI Event Streams Overview | - | ❌ | Missing overview page |
| AG-UI | `integrations/ag-ui.mdx` | ⚠️ | `depsFactory` bug fixed; SSE event sequence diagram TBD |
| Vercel AI (UI streaming) | `integrations/vercel-ai-ui.mdx` | ⚠️ | New page  -  was ❌; useChat / useCompletion / RSC |
| Agent2Agent (A2A) | `integrations/a2a.mdx` | ⚠️ | New page  -  was ❌; AgentCard, JSON-RPC, task lifecycle, streaming |

---

## Testing & Evals

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Testing | `concepts/testing.mdx` | ⚠️ | Consolidated; verify `captureRunMessages` examples |
| Evals Overview | `concepts/evals.mdx` | ⚠️ | New page  -  was ❌; single page, not full section |
| Eval Quick Start | - | ❌ | Missing |
| Eval Core Concepts | - | ❌ | Missing |
| Evaluators Overview | - | ❌ | Missing |
| Built-in Evaluators | - | ❌ | Missing |
| LLM Judge | - | ❌ | Missing |
| Custom Evaluators | - | ❌ | Missing |
| Dataset Management | - | ❌ | Missing |
| Concurrency & Performance | - | ❌ | Missing |
| Multi-Run Evaluation | - | ❌ | Missing |
| Metrics & Attributes | - | ❌ | Missing |

> Note: Full evals section remains a future milestone requiring framework-level support.

---

## Examples

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Examples landing | `examples/index.mdx` | ⚠️ | New page  -  was ❌ |
| Pydantic Model (hello world) | `getting-started/hello-world.mdx` + `examples/hello-world.mdx` | ⚠️ | Consolidated from 4 fragmented pages |
| Weather agent | `examples/weather-agent.mdx` | ⚠️ | New page  -  was ❌ |
| Chat App | `examples/chat-app.mdx` | ⚠️ | New page  -  was ❌ |
| Bank Support | `examples/bank-support.mdx` | ⚠️ | New page  -  was ❌ |
| SQL Generation | - | ❌ | Missing |
| RAG | `examples/rag.mdx` | ⚠️ | New page  -  was ❌ |
| Stream Markdown | - | ❌ | Missing |
| Flight Booking | - | ❌ | Missing |
| Question Graph | `examples/graph-workflow.mdx` | ⚠️ | New page  -  was ❌ |
| AG-UI example | - | ❌ | Missing |

---

## Human in the Loop

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Human in the Loop | `concepts/human-in-the-loop.mdx` | ⚠️ | Rewritten; verify approval sequence diagram + `agent.resume()` flow |

---

## Project / Meta

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Contributing | - | ❌ | Missing |
| Upgrade Guide / Changelog | - | ❌ | Missing |
| Version Policy | - | ❌ | Missing |
| Feature Parity (vs Pydantic AI) | `reference/features.mdx` | ✅ | Exists |
| Acknowledgments | `meta/acknowledgments.mdx` | ✅ | New  -  was ❌ |

---

## API Reference

| Pydantic AI | Our equivalent | Status | Notes |
|---|---|---|---|
| Per-module API reference | Scattered across concept pages | ⚠️ | Not organized as true API reference |
| `agent` module | `concepts/agents.mdx` | ⚠️ | |
| `tools` module | `concepts/tools.mdx` | ⚠️ | |
| `toolsets` module | `concepts/toolsets.mdx` | ⚠️ | |
| `messages` module | `concepts/messages.mdx` | ⚠️ | |
| `output` module | `concepts/results.mdx` | ⚠️ | |
| `result` module | - | ❌ | No dedicated RunResult / StreamResult reference |
| `exceptions` module | `advanced/error-handling.mdx` | ⚠️ | Mixed with guide content |
| `usage` module | - | ⚠️ | No dedicated page; verify coverage |
| `settings` module | `concepts/models.mdx` (likely) | ⚠️ | |
| `mcp` module | `integrations/mcp-client.mdx` | ⚠️ | |
| `graph` module | `concepts/graph.mdx` | ⚠️ | |
| `ag_ui` module | `integrations/ag-ui.mdx` | ⚠️ | |
| `a2a` module | `integrations/a2a.mdx` | ⚠️ | Was ❌ |
| `temporal` module | `integrations/temporal.mdx` | ⚠️ | |
| `testing` module | `concepts/testing.mdx` | ⚠️ | |
| `multimodal` module | `advanced/multimodal.mdx` | ⚠️ | |
| `embeddings` module | - | ❌ | Not applicable (no embeddings in vibes) |
| `direct` module | `advanced/direct-model-requests.mdx` | ⚠️ | Was ❌ |
| Models (per-provider) | - | ❌ | No per-provider API reference pages |

---

## Summary counts

| Status | Count |
|---|---|
| ✅ Exists and complete | 2 |
| ⚠️ Exists but partial/needs verification | 51 |
| ❌ Missing entirely | 28 |

**Total Pydantic AI items tracked: ~81**

**Progress since last update:** ~22 items moved from ❌ → ⚠️ (direct-model-requests, models, thinking, mcp-server, vercel-ai-ui, a2a, graph steps still missing, evals overview, all examples, acknowledgments, a2a + direct API ref modules)

---

## Biggest Gaps (updated)

| Gap | Status | Why it matters |
|---|---|---|
| **Models / providers section** | ⚠️ `concepts/models.mdx` exists | Pydantic AI has 10 dedicated per-provider pages; we have one unified page  -  good start but may need splitting |
| **A2A docs** | ⚠️ `integrations/a2a.mdx` exists | Was fully missing; now exists  -  verify completeness |
| **MCP Server** | ⚠️ `integrations/mcp-server.mdx` exists | Was fully missing; now exists |
| **Examples section** | ⚠️ 7 of 11 examples exist | Good progress; still missing SQL Generation, Stream Markdown, Flight Booking, AG-UI example |
| **Thinking / extended reasoning** | ⚠️ `concepts/thinking.mdx` exists | Was fully missing; now exists |
| **Vercel AI UI streaming** | ⚠️ `integrations/vercel-ai-ui.mdx` exists | Was fully missing; now exists |
| **Durable execution overview** | ⚠️ covered in `integrations/temporal.mdx` | Verify overview section present; DBOS and Prefect still missing |
| **Evals** | ⚠️ `concepts/evals.mdx` (single page) | Full 12-page section still missing  -  needs framework-level support |
| **Graph sub-pages** | ❌ 4 pages missing | Steps, Joins & Reducers, Decisions, Parallel Execution  -  all missing |
| **Built-in / Common / Third-Party Tools** | ❌ | Missing  -  not yet addressed in rewrite |

---

## Priority order for rewrite

### P0 - Core teaching flow ✅ DONE
1. `index.mdx` ✅
2. `introduction.mdx` ✅
3. `getting-started/hello-world.mdx` ✅
4. `concepts/agents.mdx` ✅
5. `concepts/dependencies.mdx` ✅
6. `concepts/tools.mdx` ✅
7. `concepts/toolsets.mdx` ✅
8. `concepts/results.mdx` ✅
9. `concepts/messages.mdx` ✅
10. `concepts/streaming.mdx` ✅

### P1 - Complete the teaching story ✅ DONE
11. `concepts/human-in-the-loop.mdx` ✅
12. `concepts/testing.mdx` ✅
13. `concepts/debugging.mdx` ✅
14. `concepts/multi-agent.mdx` ✅
15. `concepts/graph.mdx` ✅
16. `concepts/models.mdx` ✅
17. `concepts/thinking.mdx` ✅

### P2 - Integrations ✅ DONE
18. `integrations/mcp-client.mdx` ✅
19. `integrations/mcp-server.mdx` ✅
20. `integrations/ag-ui.mdx` ✅
21. `integrations/a2a.mdx` ✅
22. `integrations/temporal.mdx` ✅
23. `integrations/vercel-ai-ui.mdx` ✅

### P3 - Examples ✅ MOSTLY DONE
24. `examples/index.mdx` ✅
25. `examples/hello-world.mdx` ✅
26. `examples/weather-agent.mdx` ✅
27. `examples/chat-app.mdx` ✅
28. `examples/bank-support.mdx` ✅
29. `examples/rag.mdx` ✅
30. `examples/graph-workflow.mdx` ✅
31. `examples/human-in-the-loop.mdx` ✅
32. `examples/a2a.mdx` ✅
- `examples/sql-generation.mdx` ❌ not yet written
- `examples/stream-markdown.mdx` ❌ not yet written
- `examples/flight-booking.mdx` ❌ not yet written
- `examples/ag-ui.mdx` ❌ not yet written

### P4 - Advanced topics ✅ DONE
33. `advanced/multimodal.mdx` ✅
34. `advanced/error-handling.mdx` ✅
35. `advanced/direct-model-requests.mdx` ✅

### P5 - Project pages ✅ DONE
36. `meta/acknowledgments.mdx` ✅
37. `contributing.mdx` ❌ not yet written
38. `changelog.mdx` ❌ not yet written

### Next up - verification pass
- Audit each ⚠️ page for content quality, correct API, and diagram completeness
- Add missing examples (SQL, Stream Markdown, Flight Booking, AG-UI)
- Consider graph sub-pages (Steps, Joins, Decisions, Parallel)
- Built-in / Common / Third-Party Tools pages

### Future milestone - evals
Full evals section (~12 pages). Needs framework-level evals support.
- `evals/index.mdx`
- `evals/quick-start.mdx`
- `evals/concepts.mdx`
- `evals/evaluators.mdx`
- `evals/llm-judge.mdx`
- `evals/custom-evaluators.mdx`
- `evals/datasets.mdx`
- `evals/metrics.mdx`
