# Docs Parity: Vibes vs pydantic-ai

> Maps every pydantic-ai left-sidebar item to our current state.
> Status: ✅ exists | ⚠️ partial/wrong | ❌ missing

---

## Top Level

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Home / Landing | `index.mdx` | ⚠️ | No benefits-first hero, no mermaid arch diagram, no acknowledgments |
| Installation | `getting-started/install.mdx` | ⚠️ | Exists but no provider list, no architecture diagram |
| Getting Help | — | ❌ | Missing |
| Troubleshooting | — | ❌ | Missing |
| Pydantic AI Gateway | — | ❌ | Not applicable (no equivalent service) |

---

## Core Concepts

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Agents | `reference/core/agents.mdx` | ⚠️ | Reference-style only, no deep teaching, no mermaid loop diagram |
| Dependencies | `concepts/dependency-injection.mdx` + `reference/core/dependencies.mdx` + `reference/core/run-context.mdx` | ⚠️ | Split across 3 pages, not cohesive |
| Function Tools | `reference/core/tools.mdx` | ⚠️ | Reference-style only, missing `prepare`, `argsValidator`, `requiresApproval` details |
| Output (Results) | `reference/core/structured-output.mdx` + `reference/core/result-validators.mdx` | ⚠️ | Split across 2 pages, no output mode comparison diagram |
| Messages and Chat History | `reference/advanced/message-history.mdx` | ⚠️ | Exists but thin, no serialization examples, no history processor coverage |
| Direct Model Requests | — | ❌ | Missing — no equivalent for calling model directly without agent |
| Streaming | `reference/core/streaming.mdx` | ⚠️ | Exists, missing event stream diagram and `runStreamEvents` examples |

---

## Models & Providers

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Models overview | — | ❌ | Missing — we defer to Vercel AI SDK but need a page explaining the model layer |
| OpenAI | — | ❌ | Missing per-provider page |
| Anthropic | — | ❌ | Missing per-provider page |
| Google (Gemini) | — | ❌ | Missing per-provider page |
| Groq | — | ❌ | Missing per-provider page |
| Mistral | — | ❌ | Missing per-provider page |
| Ollama (local) | — | ❌ | Missing per-provider page |
| OpenAI-compatible | — | ❌ | Missing per-provider page |
| Model Settings | `reference/advanced/model-settings.mdx` | ⚠️ | Exists but shallow, no per-provider settings |
| Fallback Model | — | ❌ | Missing — no docs on using AI SDK's fallback/retry model pattern |

---

## Tools & Toolsets

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Function Tools | `reference/core/tools.mdx` | ⚠️ | See above |
| Advanced Tool Features | — | ❌ | Missing — no docs on `prepare`, dynamic filtering, `argsValidator`, `sequential` |
| Toolsets | `reference/core/toolsets.mdx` | ⚠️ | Exists but no composition diagrams, missing `WrapperToolset` examples |
| Deferred Tools | `reference/advanced/deferred-tools.mdx` | ⚠️ | Exists, but `agent.resume()` flow not shown with mermaid sequence |
| Built-in Tools | — | ❌ | Missing — no page listing what tools ship with the framework |
| Common Tools | — | ❌ | Missing |
| Third-Party Tools | — | ❌ | Missing — no guidance on wrapping external tool libraries |

---

## Advanced Features

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Image / Audio / Video / Document Input | `reference/advanced/multi-modal.mdx` | ⚠️ | Exists but thin, no examples for audio/video/documents |
| Thinking (extended reasoning) | — | ❌ | Missing — no docs on passing `thinking` config to Anthropic/Google models |
| HTTP Request Retries | — | ❌ | Missing — no docs on provider-level retry config |
| Usage Limits | `reference/advanced/usage-limits.mdx` | ✅ | Exists and reasonably complete |
| Error Handling | `concepts/error-handling.mdx` | ⚠️ | Exists but no error taxonomy diagram, no recovery flow examples |

---

## MCP (Model Context Protocol)

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| MCP Overview | `reference/integrations/mcp.mdx` | ⚠️ | Exists but all on one page, needs splitting |
| MCP Client | `reference/integrations/mcp.mdx` | ⚠️ | Covered inline, no dedicated page |
| FastMCP Client | — | ❌ | Missing — no docs on FastMCP integration |
| MCP Server | — | ❌ | Missing — no docs on exposing the agent as an MCP server |

---

## Multi-Agent & Graph

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Multi-Agent Patterns | `reference/advanced/multi-agent.mdx` + `guides/multi-agent-systems.mdx` | ⚠️ | Split, no delegation flow diagrams |
| Graph Overview | `reference/integrations/graph.mdx` | ⚠️ | Exists but wrong API (constructor, `this.next()` bug) |
| Graph Steps | — | ❌ | Missing — no dedicated steps deep-dive |
| Graph Joins & Reducers | — | ❌ | Missing |
| Graph Decisions | — | ❌ | Missing |
| Graph Parallel Execution | — | ❌ | Missing |

---

## Integrations

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Debugging & Monitoring (Logfire) | `reference/integrations/otel.mdx` | ⚠️ | Exists, but thin — no span hierarchy diagram, no sampling config |
| Durable Execution Overview | — | ❌ | Missing overview page |
| Durable Execution: Temporal | `reference/integrations/temporal.mdx` | ⚠️ | Exists but needs mermaid workflow diagram |
| Durable Execution: DBOS | — | ❌ | Missing |
| Durable Execution: Prefect | — | ❌ | Missing |
| UI Event Streams Overview | — | ❌ | Missing overview page |
| AG-UI | `reference/integrations/ag-ui.mdx` | ⚠️ | Exists but wrong API (`depsFactory` bug), no SSE event sequence diagram |
| Vercel AI (UI streaming) | — | ❌ | Missing — no docs on streaming to Vercel AI SDK useChat / useCompletion |
| Agent2Agent (A2A) | — | ❌ | Missing entirely — A2A adapter exists in code but zero docs |

---

## Testing & Evals

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Testing | `getting-started/testing.mdx` + `reference/core/testing.mdx` | ⚠️ | Split across 2 pages, no `captureRunMessages` examples, no eval patterns |
| Evals Overview | — | ❌ | Missing entirely |
| Eval Quick Start | — | ❌ | Missing |
| Eval Core Concepts | — | ❌ | Missing |
| Evaluators Overview | — | ❌ | Missing |
| Built-in Evaluators | — | ❌ | Missing |
| LLM Judge | — | ❌ | Missing |
| Custom Evaluators | — | ❌ | Missing |
| Dataset Management | — | ❌ | Missing |
| Concurrency & Performance | — | ❌ | Missing |
| Multi-Run Evaluation | — | ❌ | Missing |
| Metrics & Attributes | — | ❌ | Missing |

> Note: Evals is a large section in pydantic-ai. We have no equivalent. This is a big gap but also a potential future milestone, not a blocker for the initial rewrite.

---

## Examples

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Examples landing | — | ❌ | Missing |
| Pydantic Model (hello world) | `getting-started/first-agent.mdx` | ⚠️ | Exists but fragmented across 4 separate getting-started pages |
| Weather agent | — | ❌ | Missing runnable example |
| Chat App | — | ❌ | Missing |
| Bank Support | — | ❌ | Missing — the canonical pydantic-ai teaching example, we have no equivalent |
| SQL Generation | — | ❌ | Missing |
| RAG | — | ❌ | Missing |
| Stream Markdown | — | ❌ | Missing |
| Flight Booking | — | ❌ | Missing |
| Question Graph | — | ❌ | Missing |
| AG-UI example | — | ❌ | Missing |

---

## Human in the Loop

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Human in the Loop | `guides/human-in-the-loop.mdx` | ⚠️ | Exists but no approval sequence diagram, `agent.resume()` flow incomplete |

---

## Project / Meta

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Contributing | — | ❌ | Missing |
| Upgrade Guide / Changelog | — | ❌ | Missing |
| Version Policy | — | ❌ | Missing |
| Feature Parity (vs pydantic-ai) | `reference/features.mdx` | ✅ | Exists |
| Acknowledgments | — | ❌ | Missing |

---

## API Reference

| pydantic-ai | Our equivalent | Status | Notes |
|---|---|---|---|
| Per-module API reference | Scattered across reference pages | ⚠️ | Not organized as true API reference — mixed with guides |
| `agent` module | `reference/core/agents.mdx` | ⚠️ | |
| `tools` module | `reference/core/tools.mdx` | ⚠️ | |
| `toolsets` module | `reference/core/toolsets.mdx` | ⚠️ | |
| `messages` module | `reference/advanced/message-history.mdx` | ⚠️ | |
| `output` module | `reference/core/structured-output.mdx` | ⚠️ | |
| `result` module | — | ❌ | No dedicated RunResult / StreamResult reference |
| `exceptions` module | `concepts/error-handling.mdx` | ⚠️ | Mixed with guide content |
| `usage` module | `reference/advanced/usage-limits.mdx` | ⚠️ | Mixed with guide content |
| `settings` module | `reference/advanced/model-settings.mdx` | ⚠️ | |
| `mcp` module | `reference/integrations/mcp.mdx` | ⚠️ | |
| `graph` module | `reference/integrations/graph.mdx` | ⚠️ | |
| `ag_ui` module | `reference/integrations/ag-ui.mdx` | ⚠️ | |
| `a2a` module | — | ❌ | |
| `temporal` module | `reference/integrations/temporal.mdx` | ⚠️ | |
| `testing` module | `reference/core/testing.mdx` | ⚠️ | |
| `multimodal` module | `reference/advanced/multi-modal.mdx` | ⚠️ | |
| `embeddings` module | — | ❌ | Not applicable (no embeddings in vibes) |
| `direct` module | — | ❌ | No docs on direct model calls without agent |
| Models (per-provider) | — | ❌ | No per-provider API reference |

---

## Summary Counts

| Status | Count |
|---|---|
| ✅ Exists and complete | 2 |
| ⚠️ Exists but partial/wrong/thin | 31 |
| ❌ Missing entirely | 47 |

**Total pydantic-ai items tracked: ~80**

---

## Biggest Gaps (called out explicitly)

| Gap | Why it matters |
|---|---|
| **Models / providers section** | pydantic-ai has 10+ per-provider pages. We have zero. Every new user's first question is "how do I use Anthropic / OpenAI / Gemini?" — completely unanswered. |
| **A2A — zero docs** | The A2A adapter exists in the codebase (`lib/a2a/`) but there is not a single documentation page. Anyone using agent-to-agent communication is flying blind. |
| **MCP Server** | We only document the MCP client side (consuming tools from an MCP server). We have no docs on exposing your Vibes agent as an MCP server that other tools can call. |
| **Examples section** | pydantic-ai has 17 runnable, copy-paste examples with a dedicated landing page. We have zero standalone examples. The Getting Started pages have snippets but no complete, runnable programs. |
| **Thinking / extended reasoning** | No docs on passing `thinking` / `budget_tokens` config to Anthropic or Google models for extended reasoning. This is a top feature for serious users. |
| **Vercel AI UI streaming** | No docs on connecting a Vibes agent stream to Vercel AI SDK's `useChat` / `useCompletion` React hooks. This is the most common frontend integration pattern. |
| **Durable execution overview** | The Temporal page exists but there's no overview explaining what durable execution is and why you'd want it. Also no DBOS or Prefect alternatives documented. |
| **Evals** | pydantic-ai has a 12-page eval section. We have nothing. LLM evals are table stakes for production AI — this is a major credibility gap. |

---

## Priority Order for Rewrite

### P0 — Core teaching flow (blocking everything else)
1. `index.mdx` — rewrite with benefits-first hero + mermaid arch diagram + acknowledgments
2. `introduction.mdx` — new: design philosophy + "Standing on the Shoulders of Giants"
3. `getting-started/hello-world.mdx` — new: single progressive example (replaces 4 fragmented pages)
4. `concepts/agents.mdx` — deep dive with full agent loop mermaid diagram
5. `concepts/dependencies.mdx` — DI as signature feature, RunContext fan-out diagram
6. `concepts/tools.mdx` — comprehensive: all tool types + execution pipeline diagram
7. `concepts/toolsets.mdx` — composition diagram + per-turn resolution
8. `concepts/results.mdx` — output modes comparison diagram + validation flow
9. `concepts/messages-and-chat-history.mdx` — multi-turn + history processors + serialization
10. `concepts/streaming.mdx` — stream() + runStreamEvents() + event timeline diagram

### P1 — Complete the teaching story
11. `concepts/human-in-the-loop.mdx` — approval sequence diagram + resume() flow
12. `concepts/testing.mdx` — TestModel + FunctionModel + captureRunMessages
13. `concepts/debugging-and-monitoring.mdx` — OTel span hierarchy diagram
14. `concepts/multi-agent.mdx` — agent-as-tool + delegation flow
15. `concepts/graph.mdx` — fix API bugs + full FSM mermaid + persistence flow
16. `concepts/models.mdx` — new: model layer explanation + all provider quickstarts (Anthropic, OpenAI, Google, Groq, Mistral, Ollama, OpenAI-compatible) [**BIGGEST GAP #1**]
17. `concepts/thinking.mdx` — new: extended reasoning config for Anthropic/Google [**BIGGEST GAP #5**]

### P2 — Integrations (own pages)
18. `integrations/mcp-client.mdx` — MCP client: MCPToolset, stdio, HTTP, MCPManager
19. `integrations/mcp-server.mdx` — new: expose your agent as an MCP server [**BIGGEST GAP #3**]
20. `integrations/ag-ui.mdx` — fix API bug + SSE event sequence diagram
21. `integrations/a2a.mdx` — new: A2A full docs, AgentCard, JSON-RPC, task lifecycle, streaming [**BIGGEST GAP #2**]
22. `integrations/temporal.mdx` — rewrite with durable execution overview + mermaid workflow diagram [**BIGGEST GAP #7**]
23. `integrations/vercel-ai-ui.mdx` — new: useChat / useCompletion / RSC streaming [**BIGGEST GAP #6**]

### P3 — Examples (runnable, copy-paste) [**BIGGEST GAP #4**]
24. `examples/index.mdx` — examples landing page
25. `examples/hello-world.mdx` — simplest possible agent (5 lines)
26. `examples/weather-agent.mdx` — tools + external API + structured output
27. `examples/chat-app.mdx` — multi-turn chat with history + Vercel AI frontend
28. `examples/bank-support.mdx` — the canonical pydantic-ai teaching example, ported to TS
29. `examples/rag.mdx` — RAG pattern with tools + vector search
30. `examples/graph-workflow.mdx` — graph FSM: multi-step research pipeline
31. `examples/human-in-the-loop.mdx` — deferred approval flow end-to-end
32. `examples/a2a-agent.mdx` — two agents talking to each other via A2A

### P4 — Advanced topics
33. `concepts/multimodal.mdx` — expand multi-modal: images, audio, video, documents
34. `concepts/error-handling.mdx` — rewrite with full error taxonomy diagram + recovery patterns
35. `concepts/direct-model-requests.mdx` — new: calling the model directly without an agent

### P5 — Project pages
36. `acknowledgments.mdx` — new: thank pydantic-ai + Vercel AI SDK
37. `contributing.mdx` — new
38. `changelog.mdx` — new

### Future Milestone — Evals [**BIGGEST GAP #8**]
Full evals section (~12 pages). Major feature gap — needs framework-level support before docs can be written.
- `evals/index.mdx` — overview
- `evals/quick-start.mdx`
- `evals/concepts.mdx`
- `evals/evaluators.mdx`
- `evals/llm-judge.mdx`
- `evals/custom-evaluators.mdx`
- `evals/datasets.mdx`
- `evals/metrics.mdx`
