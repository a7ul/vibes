# Feature Parity: pydantic-ai → TypeScript Framework

This document tracks every pydantic-ai feature and its status in the TypeScript framework. Use it as a backlog when deciding what to port next.

**Legend:** ✅ Ported · 🚧 Partial · ❌ Not ported

---

## Agent API

| Feature                    | pydantic-ai                                     | Status | Notes                                                        |
| -------------------------- | ----------------------------------------------- | ------ | ------------------------------------------------------------ |
| `agent.run()`              | `agent.run(prompt, deps=x)`                     | ✅     | `agent.run(prompt, { deps: x })`                             |
| `agent.run_stream()`       | `agent.run_stream(prompt)`                      | ✅     | `agent.stream(prompt)`                                       |
| Agent name                 | `agent.name`                                    | ✅     | `name` on `AgentOptions`                                     |
| System prompt (static)     | `system_prompt="..."`                           | ✅     | `systemPrompt: "..."`                                        |
| System prompt (dynamic)    | `@agent.system_prompt` decorator                | ✅     | `agent.addSystemPrompt(fn)` or `systemPrompt: [fn]`          |
| Tools                      | `@agent.tool` / `tools=[...]`                   | ✅     | `agent.addTool(tool({...}))`                                 |
| Structured output          | `result_type: BaseModel`                        | ✅     | `outputSchema: z.object({...})`                              |
| Result validators          | `@agent.result_validator`                       | ✅     | `agent.addResultValidator(fn)`                               |
| Max retries                | `max_retries` / `max_result_retries`            | ✅     | `maxRetries` on `AgentOptions`                               |
| Max turns                  | `max_turns`                                     | ✅     | `maxTurns` on `AgentOptions`                                 |
| Message history            | `message_history=`                              | ✅     | `{ messageHistory: [...] }` on `run()`                       |
| Metadata tagging           | `metadata=` on run                              | ✅     | `{ metadata: {...} }` on `run()`/`stream()` — accessible via `ctx.metadata` |
| `Agent.override()`         | Context manager swapping model/deps/toolsets    | ✅     | `agent.override({ model, tools, ... }).run(prompt)`          |
| Sync run                   | `agent.run_sync()`                              | ❌     | Deno is async-native — low priority                          |
| Event-stream run           | `agent.run_stream_events()`                     | ❌     | Async iterable of typed `AgentStreamEvent` objects           |
| Node-level iteration       | `agent.iter()` / `AgentRun`                     | ❌     | Manual graph traversal step-by-step                          |
| End strategy               | `end_strategy`                                  | ❌     | `'early'` (default) or `'exhaustive'` — controls whether agent continues after finding output alongside pending tool calls |
| Max concurrency            | `max_concurrency`                               | ❌     | Cap concurrent tool call executions; accepts `int` or `ConcurrencyLimit` |
| `instructions` field       | `@agent.instructions` decorator                 | ❌     | Dynamic instructions; differs from `system_prompt` in message history handling |
| Last run messages          | `agent.last_run_messages`                       | ❌     | Removed from pydantic-ai; superseded by `result.new_messages()` |
| Model-specific settings    | `model_settings=` on `run()`                    | ❌     | Per-run overrides for temperature, max_tokens, timeout       |

---

## Tools

| Feature                 | pydantic-ai                                     | Status | Notes                                                             |
| ----------------------- | ----------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Tools with context      | `@agent.tool`                                   | ✅     | `tool({ execute: (ctx, args) => ... })`                           |
| Tool `maxRetries`       | `retries=` on `@agent.tool`                     | ✅     | `maxRetries` on `ToolDefinition`                                  |
| Plain tools (no ctx)    | `@agent.tool_plain`                             | ✅     | `plainTool({ name, description, parameters, execute })`           |
| Tool `prepare` method   | `prepare=` on `Tool` class                      | ✅     | `prepare: (ctx) => tool \| null` on `ToolDefinition`              |
| `args_validator`        | `args_validator=` on tool                       | ✅     | `argsValidator: (args) => void` on `ToolDefinition`               |
| `Tool.from_schema()`    | Build tool from raw JSON schema                 | ❌     | For wrapping external APIs with known schemas                     |
| Docstring extraction    | Auto-doc from Python docstrings                 | ❌     | Generate `description` + param docs from JSDoc                    |
| Multi-modal returns     | Return images / audio / binary from tools       | ❌     | `BinaryContent` / `BinaryImage` — tools must return JSON today    |
| `UploadedFile` support  | `UploadedFile` for provider file uploads        | ❌     | Pass file references between tools and model (added v1.65)        |
| Tool result metadata    | Attach metadata keyed by `tool_call_id`         | ❌     | Not sent to LLM; useful for logging/debugging                     |
| Output functions        | Final-action tools (no model feedback loop)     | ❌     | Tool that ends the run via `ToolOutput` marker class              |
| Sequential execution    | `sequential=True` on tool                       | ❌     | Force serial execution for tools that can't run concurrently      |
| Deferred tools          | Tools requiring human approval before execution | ❌     | Human-in-the-loop pattern (see Deferred Tools section below)      |
| MCP server tools        | Connect external MCP servers as tool providers  | ❌     | Mount any MCP server as a tool source (see MCP section below)     |

---

## Toolsets

| Feature                   | pydantic-ai                                  | Status | Notes                                                             |
| ------------------------- | -------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `FunctionToolset`         | Group locally defined function tools         | ✅     | `new FunctionToolset([tool1, tool2])`                             |
| `CombinedToolset`         | Merge multiple toolsets into one             | ✅     | `new CombinedToolset(ts1, ts2)`                                   |
| `FilteredToolset`         | Filter a toolset based on context            | ✅     | `new FilteredToolset(ts, (ctx) => boolean)`                       |
| `PrefixedToolset`         | Add prefix to tool names                     | ✅     | `new PrefixedToolset(ts, "prefix_")`                              |
| `RenamedToolset`          | Map new names onto existing tools            | ✅     | `new RenamedToolset(ts, { old: "new" })`                          |
| Toolset reuse             | Share toolsets across agents                 | ✅     | `Toolset` is a plain interface — pass the same instance to multiple agents |
| Runtime swap              | Replace toolsets during testing              | ✅     | `agent.override({ toolsets: [...] }).run(prompt)`                 |
| `PreparedToolset`         | Modify entire tool list before each step     | ❌     | Dynamic toolset mutation per turn                                 |
| `ApprovalRequiredToolset` | Enforce human approval on a toolset          | ❌     | Wraps any toolset with approval semantics                         |
| `WrapperToolset`          | Custom execution behaviour around a toolset  | ❌     | Subclass to override `call_tool()` for middleware-style wrapping  |
| `ExternalToolset`         | Deferred execution outside agent process     | ❌     | Used with `CallDeferred` for out-of-process tool calls            |

---

## Deferred Tools (Human-in-the-Loop & External Execution)

| Feature                     | pydantic-ai                                       | Status | Notes                                                          |
| --------------------------- | ------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `requires_approval=True`    | Mark a tool as approval-required                  | ❌     | Raises `ApprovalRequired` instead of executing                 |
| `ApprovalRequired` exception | Pause agent, surface pending calls to caller     | ❌     | Caller receives `DeferredToolRequests` with pending calls      |
| `DeferredToolRequests`      | Container of pending tool calls needing approval  | ❌     | Passed back to calling code with metadata                      |
| `DeferredToolResults`       | Provide approved (or overridden) results          | ❌     | Resume agent with original history + approved results          |
| Argument override on resume | Modify args during approval before execution      | ❌     | Approver can sanitise/change args before they execute          |
| `CallDeferred` exception    | Defer a tool call to an external process          | ❌     | Agent pauses; external system executes and returns results     |
| `ExternalToolset`           | Accept raw JSON schema tools for deferred calls   | ❌     | No Python function needed; schema-only external tools          |

---

## Output & Structured Results

| Feature                     | pydantic-ai                          | Status | Notes                                                       |
| --------------------------- | ------------------------------------ | ------ | ----------------------------------------------------------- |
| Single schema output        | `result_type: BaseModel`             | ✅     | `outputSchema: z.object({...})` via `final_result` tool     |
| Result validators           | `@agent.result_validator`            | ✅     | `addResultValidator(fn)` — throw to retry                   |
| `result.all_messages()`     | Full message history                 | ✅     | `result.messages` (full) + `result.newMessages` (this run)  |
| `result.new_messages()`     | Messages added in _this_ run only    | ✅     | `result.newMessages` on `RunResult` and `StreamResult`      |
| `@agent.output_validator`   | Validate output post-parse           | ✅     | Covered by `addResultValidator`                             |
| Union output types          | `output_type=[TypeA, TypeB]`         | ❌     | Multiple schemas, each registered as its own `final_result` variant |
| Native structured output    | `NativeOutput` marker class          | ❌     | Use model's native JSON mode instead of `final_result` tool |
| Prompted output mode        | `PromptedOutput` marker class        | ❌     | Inject schema into instructions, no tool injection          |
| Streaming structured output | Partial validation as output streams | ❌     | Progressive Zod parse during streaming                      |
| Message serialization       | `ModelMessagesTypeAdapter`           | ❌     | Serialize/deserialize messages to JSON for storage          |
| `BinaryImage` output        | Generate images as output type       | ❌     | Agent produces binary image as structured result            |
| Disable schema prompt       | `template=False` on output marker    | ❌     | Suppress schema injection into model prompt                 |

---

## Message History

| Feature                   | pydantic-ai                                   | Status | Notes                                                                  |
| ------------------------- | --------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Pass history to next run  | `message_history=result.all_messages()`       | ✅     | `{ messageHistory: result.messages }`                                  |
| `new_messages()`          | Slice of messages from current run only       | ✅     | `result.newMessages` on `RunResult` and `StreamResult`                 |
| Cross-model compatibility | Messages work across providers                | ✅     | AI SDK `CoreMessage` is provider-agnostic                              |
| History processors        | `history_processors=[...]`                    | ✅     | `historyProcessors: [trimHistoryProcessor(n), ...]` on `AgentOptions`  |
| Message serialization     | JSON roundtrip via `ModelMessagesTypeAdapter` | ❌     | No serialization helpers; `CoreMessage` is serializable but no adapter |
| Token-aware trimming      | Keep last N messages by token count           | 🚧     | `trimHistoryProcessor(n)` trims by count; token-aware not yet ported   |
| LLM-based summarization   | Summarize old turns via a model call          | ❌     | Built-in processor type; replaces old messages with a model-generated summary |
| Privacy filtering         | Strip sensitive fields before model call      | ❌     | Built-in processor type for PII removal                                |

---

## Usage & Limits

| Feature        | pydantic-ai                                               | Status | Notes                                                |
| -------------- | --------------------------------------------------------- | ------ | ---------------------------------------------------- |
| Usage tracking | `result.usage()`                                          | ✅     | `result.usage` — prompt/completion tokens + requests |
| `UsageLimits`  | Cap request count, input tokens, output tokens, tool calls| ✅     | `usageLimits: { maxRequests, maxInputTokens, ... }` on `AgentOptions` or `run()` |

---

## MCP (Model Context Protocol)

| Feature                        | pydantic-ai                                    | Status | Notes                                                          |
| ------------------------------ | ---------------------------------------------- | ------ | -------------------------------------------------------------- |
| `MCPServerStdio`               | Subprocess stdio transport                     | ❌     | Launch local MCP servers as child processes                    |
| `MCPServerStreamableHTTP`      | HTTP Streamable transport                      | ❌     | Connect to remote MCP servers over HTTP                        |
| `MCPServerSSE`                 | Server-Sent Events transport (deprecated)      | ❌     | Legacy SSE transport; prefer StreamableHTTP                    |
| Dynamic tool discovery         | Auto-convert MCP tools to pydantic-ai tools    | ❌     | All MCP-exposed tools become usable tools automatically        |
| Elicitation support            | MCP server can request structured input        | ❌     | Server prompts user for structured data mid-run via `elicitation_callback` |
| Server instructions            | Access MCP server `instructions` post-connect  | ❌     | Inject server instructions into system prompt                  |
| Tool caching                   | Cache discovered tools with invalidation       | ❌     | Avoid re-fetching tool list on every run                       |
| Multi-server support           | Mount multiple MCP servers simultaneously      | ❌     | One async context manager per server                           |
| Config file loading            | Load MCP config with env variable references   | ❌     | `mcp.json`-style config with `${ENV_VAR}` interpolation        |

---

## Testing

| Feature                      | pydantic-ai                                                       | Status | Notes                                                |
| ---------------------------- | ----------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| Mock model                   | `MockLanguageModelV1` (from `ai/test`)                            | ✅     | Equivalent to pydantic-ai's `TestModel`              |
| Multi-turn mock              | `mockValues(...)`                                                 | ✅     | Cycle through responses across turns                 |
| Stream mock                  | `convertArrayToReadableStream`                                    | ✅     | Build mock stream chunks                             |
| `Agent.override()`           | Swap model/deps/toolsets in tests without modifying app code      | ✅     | `agent.override({ model: mockModel }).run(prompt)`   |
| `capture_run_messages()`     | Context manager to inspect all model request/response objects     | ✅     | `captureRunMessages(() => agent.run(...))` returns `messages[][]` |
| `ALLOW_MODEL_REQUESTS=False` | Global flag to prevent accidental real API calls                  | ✅     | `setAllowModelRequests(false)` — throws `ModelRequestsDisabledError` |
| `TestModel`                  | Auto-generates valid structured data from schema, calls all tools | ❌     | Smarter than `MockLanguageModelV1` — schema-aware    |
| `FunctionModel`              | Custom function drives model responses                            | ❌     | Full control via user-supplied function              |

---

## Multi-Agent

| Feature               | pydantic-ai                                           | Status | Notes                                                          |
| --------------------- | ----------------------------------------------------- | ------ | -------------------------------------------------------------- |
| Agent-as-tool         | Tool that calls `child.run(usage=ctx.usage)` internally | ✅   | Pattern: `tool({ execute: async (ctx, { prompt }) => { const r = await child.run(prompt, { deps: ctx.deps }); ctx.usage.requests += r.usage.requests; return r.output; } })` |
| Usage aggregation     | Pass `usage=ctx.usage` to sub-agent to merge costs    | ✅     | Manually add sub-agent usage to `ctx.usage` inside the tool   |
| Programmatic hand-off | App code dispatches agents sequentially               | ❌     | Documented pattern in pydantic-ai — no dedicated helpers       |
| A2A protocol          | `agent.to_a2a()` — expose agent as ASGI A2A server    | ❌     | Agent-to-Agent interoperability standard (Google, 2025)        |
| `pydantic_graph` — FSM | Typed state machine with `BaseNode`                  | ❌     | Separate library; type-safe edges and node execution           |
| Graph state persistence | `SimpleStatePersistence`, `FileStatePersistence`    | ❌     | Pause/resume graph runs across process restarts                |
| Graph visualization   | Mermaid diagram generation                            | ❌     | Auto-generate flow diagrams from graph definition              |
| `Graph.iter()` / `.next()` | Manual stepping through graph nodes            | ❌     | Human-in-the-loop control at graph level                       |

---

## Observability

| Feature                   | pydantic-ai                              | Status | Notes                                                                   |
| ------------------------- | ---------------------------------------- | ------ | ----------------------------------------------------------------------- |
| Logfire integration       | Auto-traces runs, turns, and tool calls  | ❌     | Built-in instrumentation with visual flow tracking                      |
| OpenTelemetry support     | OTel Gen-AI semantic conventions         | ❌     | Pluggable backend: Langfuse, W&B Weave, Arize, custom                   |
| Run-level spans           | Structured spans per run with metadata   | ❌     |                                                                         |
| Tool-level spans          | Span per tool call with args and result  | ❌     |                                                                         |
| HTTPX instrumentation     | Capture raw HTTP request/response        | ❌     | `capture_all=True` for deep debugging                                   |
| Custom `TracerProvider`   | Bring your own OTel tracer               | ❌     | Override default tracer for custom routing                              |
| Content exclusion         | Strip prompt/response from spans         | ❌     | Privacy-first observability — record structure but not content          |

---

## Evaluation Framework (Pydantic Evals)

| Feature               | pydantic-ai                                        | Status | Notes                                                          |
| --------------------- | -------------------------------------------------- | ------ | -------------------------------------------------------------- |
| Datasets & Cases      | `Dataset`, `Case` — typed test scenarios           | ❌     | Code-first approach; inputs, expected outputs, metadata        |
| Built-in evaluators   | Exact match, type validation                       | ❌     | Standard scoring functions out of the box                      |
| LLM-as-judge          | LLM-based evaluators for subjective qualities      | ❌     | Use a model to score another model's output                    |
| Custom evaluators     | Domain-specific scoring functions                  | ❌     | Arbitrary Python functions returning scores                    |
| Span-based evaluation | Score runs via OTel trace spans                    | ❌     | Attach evaluators to traced spans                              |
| Experiments           | Run and compare datasets across model/prompt combos| ❌     | Track results over time; compare A vs B                        |
| Logfire integration   | Visualize eval results in Logfire                  | ❌     | Dataset result dashboards and comparison views                 |
| Async + concurrency   | Configurable concurrency and retries for evals     | ❌     | Run many cases in parallel with rate limiting                  |

---

## Durable Execution

| Feature               | pydantic-ai                                        | Status | Notes                                                          |
| --------------------- | -------------------------------------------------- | ------ | -------------------------------------------------------------- |
| Temporal integration  | `TemporalAgent` — offloads model/tool calls to activities | ❌ | Replay-based fault tolerance; progress preserved across restarts |
| DBOS integration      | Postgres-backed state checkpointing                | ❌     | Auto-resume from last completed step after crash               |
| Prefect integration   | Transactional task semantics with cache keys       | ❌     | Skip completed tasks on re-run; resume from failure point      |

---

## AG-UI Protocol

| Feature                      | pydantic-ai                                          | Status | Notes                                                    |
| ---------------------------- | ---------------------------------------------------- | ------ | -------------------------------------------------------- |
| AG-UI event streaming        | `AGUIAdapter.run_stream()` — agent-to-UI events      | ❌     | Standardised event stream for UI integration (CopilotKit) |
| Follow-up messaging          | Continue conversation after tool call results        | ❌     | AG-UI follow-up messaging post tool calls                |
| Structured event types       | Typed event payloads for all agent actions           | ❌     | Tool calls, text deltas, results — all as typed events   |

---

## Multi-Modal Support

| Feature                  | pydantic-ai                               | Status | Notes                                                     |
| ------------------------ | ----------------------------------------- | ------ | --------------------------------------------------------- |
| Image input to tools     | Pass images into tool parameters          | ❌     | Tools receive `BinaryContent` with image data             |
| Audio / video input      | Audio and video as tool parameters        | ❌     | `BinaryContent` supports multiple media types             |
| Document input           | PDFs and documents as tool parameters     | ❌     | Pass document references into tool execution              |
| `BinaryImage` output     | Agent returns a generated image           | ❌     | Output type for image-generating agents                   |
| `UploadedFile`           | File reference for provider file uploads  | ❌     | Upload files to provider, reference by ID (added v1.65)   |
