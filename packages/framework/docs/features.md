# Feature Parity: pydantic-ai → TypeScript Framework

This document tracks every pydantic-ai feature and its status in the TypeScript
framework. Use it as a backlog when deciding what to port next.

**Legend:** ✅ Ported · 🚧 Partial · ❌ Not ported

---

## Agent API

| Feature                 | pydantic-ai                                  | Status | Notes                                                                                               |
| ----------------------- | -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `agent.run()`           | `agent.run(prompt, deps=x)`                  | ✅     | `agent.run(prompt, { deps: x })`                                                                    |
| `agent.run_stream()`    | `agent.run_stream(prompt)`                   | ✅     | `agent.stream(prompt)`                                                                              |
| Agent name              | `agent.name`                                 | ✅     | `name` on `AgentOptions`                                                                            |
| System prompt (static)  | `system_prompt="..."`                        | ✅     | `systemPrompt: "..."`                                                                               |
| System prompt (dynamic) | `@agent.system_prompt` decorator             | ✅     | `agent.addSystemPrompt(fn)` or `systemPrompt: [fn]`                                                 |
| Tools                   | `@agent.tool` / `tools=[...]`                | ✅     | `agent.addTool(tool({...}))`                                                                        |
| Structured output       | `result_type: BaseModel`                     | ✅     | `outputSchema: z.object({...})`                                                                     |
| Result validators       | `@agent.result_validator`                    | ✅     | `agent.addResultValidator(fn)`                                                                      |
| Max retries             | `max_retries` / `max_result_retries`         | ✅     | `maxRetries` on `AgentOptions`                                                                      |
| Max turns               | `max_turns`                                  | ✅     | `maxTurns` on `AgentOptions`                                                                        |
| Message history         | `message_history=`                           | ✅     | `{ messageHistory: [...] }` on `run()`                                                              |
| Metadata tagging        | `metadata=` on run                           | ✅     | `{ metadata: {...} }` on `run()`/`stream()` — accessible via `ctx.metadata`                         |
| `Agent.override()`      | Context manager swapping model/deps/toolsets | ✅     | `agent.override({ model, tools, ... }).run(prompt)`                                                 |
| Event-stream run        | `agent.run_stream_events()`                  | ✅     | `agent.runStreamEvents(prompt)` — async iterable of typed `AgentStreamEvent` objects                |
| End strategy            | `end_strategy`                               | ✅     | `endStrategy: 'early' \| 'exhaustive'` on `AgentOptions`/`RunOptions`                               |
| Max concurrency         | `max_concurrency`                            | ✅     | `maxConcurrency` on `AgentOptions` — semaphore-based cap on concurrent tool executions              |
| `instructions` field    | `@agent.instructions` decorator              | ✅     | `instructions` on `AgentOptions`/`RunOptions`; re-injected each turn, not stored in message history |
| Model-specific settings | `model_settings=` on `run()`                 | ✅     | `modelSettings: { temperature, maxTokens, ... }` on `AgentOptions` or `RunOptions`                  |
| Sync run                | `agent.run_sync()`                           | ❌     | Deno is async-native — not applicable                                                               |
| Node-level iteration    | `agent.iter()` / `AgentRun`                  | ❌     | Not applicable — use `runStreamEvents()` for step-by-step observation in async TypeScript           |
| Last run messages       | `agent.last_run_messages`                    | ❌     | Removed from pydantic-ai; superseded by `result.newMessages`                                        |

---

## Tools

| Feature                | pydantic-ai                                     | Status | Notes                                                                     |
| ---------------------- | ----------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Tools with context     | `@agent.tool`                                   | ✅     | `tool({ execute: (ctx, args) => ... })`                                   |
| Tool `maxRetries`      | `retries=` on `@agent.tool`                     | ✅     | `maxRetries` on `ToolDefinition`                                          |
| Plain tools (no ctx)   | `@agent.tool_plain`                             | ✅     | `plainTool({ name, description, parameters, execute })`                   |
| Tool `prepare` method  | `prepare=` on `Tool` class                      | ✅     | `prepare: (ctx) => tool \| null` on `ToolDefinition`                      |
| `args_validator`       | `args_validator=` on tool                       | ✅     | `argsValidator: (args) => void` on `ToolDefinition`                       |
| `Tool.from_schema()`   | Build tool from raw JSON schema                 | ✅     | `fromSchema({ name, description, jsonSchema, execute })`                  |
| Multi-modal returns    | Return images / audio / binary from tools       | ✅     | `BinaryContent` / `BinaryImage` — returned from `execute`, auto-converted |
| `UploadedFile` support | `UploadedFile` for provider file uploads        | ✅     | `UploadedFile` type + `uploadedFileSchema` for tool parameters            |
| Tool result metadata   | Attach metadata keyed by `tool_call_id`         | ✅     | `ctx.attachMetadata(toolCallId, meta)` — exposed on `result.toolMetadata` |
| Output functions       | Final-action tools (no model feedback loop)     | ✅     | `outputTool({ ... })` — sets `isOutput: true`, ends run on call           |
| Sequential execution   | `sequential=True` on tool                       | ✅     | `sequential: true` on `ToolDefinition` — acquires mutex before executing  |
| Deferred tools         | Tools requiring human approval before execution | ✅     | `requiresApproval: true` on `ToolDefinition` — see Deferred Tools section |
| MCP server tools       | Connect external MCP servers as tool providers  | ✅     | `MCPToolset` wraps any `MCPClient` — see MCP section                      |
| Docstring extraction   | Auto-doc from Python docstrings                 | ❌     | No runtime equivalent in TypeScript — use `description` field explicitly  |

---

## Toolsets

| Feature                   | pydantic-ai                                 | Status | Notes                                                                      |
| ------------------------- | ------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `FunctionToolset`         | Group locally defined function tools        | ✅     | `new FunctionToolset([tool1, tool2])`                                      |
| `CombinedToolset`         | Merge multiple toolsets into one            | ✅     | `new CombinedToolset(ts1, ts2)`                                            |
| `FilteredToolset`         | Filter a toolset based on context           | ✅     | `new FilteredToolset(ts, (ctx) => boolean)`                                |
| `PrefixedToolset`         | Add prefix to tool names                    | ✅     | `new PrefixedToolset(ts, "prefix_")`                                       |
| `RenamedToolset`          | Map new names onto existing tools           | ✅     | `new RenamedToolset(ts, { old: "new" })`                                   |
| Toolset reuse             | Share toolsets across agents                | ✅     | `Toolset` is a plain interface — pass the same instance to multiple agents |
| Runtime swap              | Replace toolsets during testing             | ✅     | `agent.override({ toolsets: [...] }).run(prompt)`                          |
| `PreparedToolset`         | Modify entire tool list before each step    | ✅     | `new PreparedToolset(inner, (ctx, tools) => tools)` — dynamic per-turn     |
| `ApprovalRequiredToolset` | Enforce human approval on a toolset         | ✅     | `new ApprovalRequiredToolset(inner)` — all tools get `requiresApproval`    |
| `WrapperToolset`          | Custom execution behaviour around a toolset | ✅     | `class MyWrapper extends WrapperToolset { callTool(...) { ... } }`         |
| `ExternalToolset`         | Deferred execution outside agent process    | ✅     | `new ExternalToolset([{ name, description, jsonSchema }])` — schema-only   |

---

## Deferred Tools (Human-in-the-Loop & External Execution)

| Feature                      | pydantic-ai                                      | Status | Notes                                                                           |
| ---------------------------- | ------------------------------------------------ | ------ | ------------------------------------------------------------------------------- |
| `requires_approval=True`     | Mark a tool as approval-required                 | ✅     | `requiresApproval: true` on `ToolDefinition` or `tool()` options                |
| `ApprovalRequired` exception | Pause agent, surface pending calls to caller     | ✅     | `ApprovalRequiredError` — catch it, inspect `.requests`, resume with results    |
| `DeferredToolRequests`       | Container of pending tool calls needing approval | ✅     | `DeferredToolRequests` class with `.requests` array                             |
| `DeferredToolResults`        | Provide approved (or overridden) results         | ✅     | `agent.resume(deferred, { results: [...] })` or `run(..., { deferredResults })` |
| Argument override on resume  | Modify args during approval before execution     | ✅     | `argsOverride` field on `DeferredToolResult`                                    |
| `CallDeferred` exception     | Defer a tool call to an external process         | ✅     | `ExternalToolset` raises `ApprovalRequiredError` for all tools                  |
| `ExternalToolset`            | Accept raw JSON schema tools for deferred calls  | ✅     | `new ExternalToolset([{ name, description, jsonSchema }])`                      |

---

## Output & Structured Results

| Feature                     | pydantic-ai                          | Status | Notes                                                                  |
| --------------------------- | ------------------------------------ | ------ | ---------------------------------------------------------------------- |
| Single schema output        | `result_type: BaseModel`             | ✅     | `outputSchema: z.object({...})` via `final_result` tool                |
| Result validators           | `@agent.result_validator`            | ✅     | `addResultValidator(fn)` — throw to retry                              |
| `result.all_messages()`     | Full message history                 | ✅     | `result.messages` (full) + `result.newMessages` (this run)             |
| `result.new_messages()`     | Messages added in _this_ run only    | ✅     | `result.newMessages` on `RunResult` and `StreamResult`                 |
| `@agent.output_validator`   | Validate output post-parse           | ✅     | Covered by `addResultValidator`                                        |
| Union output types          | `output_type=[TypeA, TypeB]`         | ✅     | `outputSchema: [schemaA, schemaB]` — registers `final_result_0`, `_1`… |
| Native structured output    | `NativeOutput` marker class          | ✅     | `outputMode: 'native'` — uses AI SDK `Output.object()` / JSON mode     |
| Prompted output mode        | `PromptedOutput` marker class        | ✅     | `outputMode: 'prompted'` — schema injected into system prompt          |
| Streaming structured output | Partial validation as output streams | ✅     | `result.partialOutput` async iterable on `StreamResult`                |
| Message serialization       | `ModelMessagesTypeAdapter`           | ✅     | `serializeMessages(msgs)` / `deserializeMessages(json)`                |
| Disable schema prompt       | `template=False` on output marker    | ✅     | `outputTemplate: false` on `AgentOptions`                              |
| `BinaryImage` output        | Generate images as output type       | ❌     | Not yet implemented as a dedicated output type                         |

---

## Message History

| Feature                   | pydantic-ai                                   | Status | Notes                                                                         |
| ------------------------- | --------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Pass history to next run  | `message_history=result.all_messages()`       | ✅     | `{ messageHistory: result.messages }`                                         |
| `new_messages()`          | Slice of messages from current run only       | ✅     | `result.newMessages` on `RunResult` and `StreamResult`                        |
| Cross-model compatibility | Messages work across providers                | ✅     | AI SDK `CoreMessage` is provider-agnostic                                     |
| History processors        | `history_processors=[...]`                    | ✅     | `historyProcessors: [trimHistoryProcessor(n), ...]` on `AgentOptions`         |
| Message serialization     | JSON roundtrip via `ModelMessagesTypeAdapter` | ✅     | `serializeMessages()` / `deserializeMessages()` in `message_serialization.ts` |
| Token-aware trimming      | Keep last N messages by token count           | ✅     | `tokenTrimHistoryProcessor(maxTokens, tokenCounter?)` — heuristic or custom   |
| LLM-based summarization   | Summarize old turns via a model call          | ✅     | `summarizeHistoryProcessor(model, { maxMessages?, summarizePrompt? })`        |
| Privacy filtering         | Strip sensitive fields before model call      | ✅     | `privacyFilterProcessor(rules)` — regex + field-path redaction                |

---

## Usage & Limits

| Feature        | pydantic-ai                                                | Status | Notes                                                                            |
| -------------- | ---------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Usage tracking | `result.usage()`                                           | ✅     | `result.usage` — prompt/completion tokens + requests                             |
| `UsageLimits`  | Cap request count, input tokens, output tokens, tool calls | ✅     | `usageLimits: { maxRequests, maxInputTokens, ... }` on `AgentOptions` or `run()` |

---

## MCP (Model Context Protocol)

| Feature                   | pydantic-ai                                   | Status | Notes                                                             |
| ------------------------- | --------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `MCPServerStdio`          | Subprocess stdio transport                    | ✅     | `MCPStdioClient` using `@modelcontextprotocol/sdk`                |
| `MCPServerStreamableHTTP` | HTTP Streamable transport                     | ✅     | `MCPHttpClient` using `StreamableHTTPClientTransport`             |
| `MCPServerSSE`            | Server-Sent Events transport (deprecated)     | ❌     | Prefer `MCPHttpClient` (StreamableHTTP)                           |
| Dynamic tool discovery    | Auto-convert MCP tools to pydantic-ai tools   | ✅     | `MCPToolset.tools()` fetches and converts MCP tools automatically |
| Elicitation support       | MCP server can request structured input       | ✅     | `elicitationCallback` option on `MCPToolset`                      |
| Server instructions       | Access MCP server `instructions` post-connect | ✅     | `mcpToolset.getServerInstructions()`                              |
| Tool caching              | Cache discovered tools with invalidation      | ✅     | `toolCacheTtlMs` option on `MCPToolset` (default 60 s)            |
| Multi-server support      | Mount multiple MCP servers simultaneously     | ✅     | `MCPManager` — add servers, call `.connect()`, use as a `Toolset` |
| Config file loading       | Load MCP config with env variable references  | ✅     | `loadMCPConfig(path)` — supports `${ENV_VAR}` interpolation       |

---

## Testing

| Feature                      | pydantic-ai                                                       | Status | Notes                                                                  |
| ---------------------------- | ----------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Mock model                   | `MockLanguageModelV1` (from `ai/test`)                            | ✅     | Equivalent to pydantic-ai's `TestModel`                                |
| Multi-turn mock              | `mockValues(...)`                                                 | ✅     | Cycle through responses across turns                                   |
| Stream mock                  | `convertArrayToReadableStream`                                    | ✅     | Build mock stream chunks                                               |
| `Agent.override()`           | Swap model/deps/toolsets in tests without modifying app code      | ✅     | `agent.override({ model: mockModel }).run(prompt)`                     |
| `capture_run_messages()`     | Context manager to inspect all model request/response objects     | ✅     | `captureRunMessages(() => agent.run(...))` returns `messages[][]`      |
| `ALLOW_MODEL_REQUESTS=False` | Global flag to prevent accidental real API calls                  | ✅     | `setAllowModelRequests(false)` — throws `ModelRequestsDisabledError`   |
| `TestModel`                  | Auto-generates valid structured data from schema, calls all tools | ✅     | `new TestModel()` / `createTestModel({ outputSchema })` — schema-aware |
| `FunctionModel`              | Custom function drives model responses                            | ✅     | `new FunctionModel((params) => result)` — full control per turn        |

---

## Multi-Agent

| Feature                    | pydantic-ai                                             | Status | Notes                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent-as-tool              | Tool that calls `child.run(usage=ctx.usage)` internally | ✅     | Pattern: `tool({ execute: async (ctx, { prompt }) => { const r = await child.run(prompt, { deps: ctx.deps }); ctx.usage.requests += r.usage.requests; return r.output; } })` |
| Usage aggregation          | Pass `usage=ctx.usage` to sub-agent to merge costs      | ✅     | Manually add sub-agent usage to `ctx.usage` inside the tool                                                                                                                  |
| Programmatic hand-off      | App code dispatches agents sequentially                 | ✅     | Documented pattern — see `docs/multi-agent.md`                                                                                                                               |
| `pydantic_graph` — FSM     | Typed state machine with `BaseNode`                     | ✅     | `Graph`, `BaseNode`, `GraphRun` — see `docs/graph.md`                                                                                                                        |
| Graph state persistence    | `SimpleStatePersistence`, `FileStatePersistence`        | ✅     | `MemoryStatePersistence`, `FileStatePersistence` — pause/resume across restarts                                                                                              |
| Graph visualization        | Mermaid diagram generation                              | ✅     | `toMermaid(graph, nodes)` returns Mermaid flowchart string                                                                                                                   |
| `Graph.iter()` / `.next()` | Manual stepping through graph nodes                     | ✅     | `graph.runIter(state, startNode)` returns `GraphRun` with `.next()` method                                                                                                   |
| A2A protocol               | `agent.to_a2a()` — expose agent as ASGI A2A server      | ❌     | Not implemented                                                                                                                                                              |

---

## Observability

| Feature                 | pydantic-ai                             | Status | Notes                                                                              |
| ----------------------- | --------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Logfire integration     | Auto-traces runs, turns, and tool calls | ❌     | Not applicable (Logfire is Python-only)                                            |
| OpenTelemetry support   | OTel Gen-AI semantic conventions        | ✅     | `instrumentAgent(agent, opts)` — uses AI SDK `experimental_telemetry`              |
| Run-level spans         | Structured spans per run with metadata  | ✅     | AI SDK auto-creates run spans when telemetry is enabled                            |
| Tool-level spans        | Span per tool call with args and result | ✅     | AI SDK auto-creates tool spans when telemetry is enabled                           |
| HTTPX instrumentation   | Capture raw HTTP request/response       | ❌     | Not applicable (no HTTPX in Deno/Node)                                             |
| Custom `TracerProvider` | Bring your own OTel tracer              | ✅     | Pass `tracer` in `TelemetrySettings` via `instrumentAgent` or `modelSettings`      |
| Content exclusion       | Strip prompt/response from spans        | ✅     | `excludeContent: true` on `InstrumentationOptions` → `recordInputs/Outputs: false` |

---

## Evaluation Framework (Pydantic Evals)

| Feature               | pydantic-ai                                         | Status | Notes                                   |
| --------------------- | --------------------------------------------------- | ------ | --------------------------------------- |
| Datasets & Cases      | `Dataset`, `Case` — typed test scenarios            | ❌     | Not yet implemented                     |
| Built-in evaluators   | Exact match, type validation                        | ❌     | Not yet implemented                     |
| LLM-as-judge          | LLM-based evaluators for subjective qualities       | ❌     | Not yet implemented                     |
| Custom evaluators     | Domain-specific scoring functions                   | ❌     | Not yet implemented                     |
| Span-based evaluation | Score runs via OTel trace spans                     | ❌     | Not yet implemented                     |
| Experiments           | Run and compare datasets across model/prompt combos | ❌     | Not yet implemented                     |
| Logfire integration   | Visualize eval results in Logfire                   | ❌     | Not applicable (Logfire is Python-only) |
| Async + concurrency   | Configurable concurrency and retries for evals      | ❌     | Not yet implemented                     |

---

## Durable Execution

| Feature              | pydantic-ai                                               | Status | Notes                                                                        |
| -------------------- | --------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Temporal integration | `TemporalAgent` — offloads model/tool calls to activities | ✅     | `TemporalAgent` + `MockTemporalAgent` — requires Node.js for Temporal worker |
| DBOS integration     | Postgres-backed state checkpointing                       | ❌     | Not implemented (skipped by design)                                          |
| Prefect integration  | Transactional task semantics with cache keys              | ❌     | Not implemented (skipped by design)                                          |

---

## AG-UI Protocol

| Feature                | pydantic-ai                                     | Status | Notes                                                             |
| ---------------------- | ----------------------------------------------- | ------ | ----------------------------------------------------------------- |
| AG-UI event streaming  | `AGUIAdapter.run_stream()` — agent-to-UI events | ✅     | `AGUIAdapter.handleRequest(input)` returns SSE `Response`         |
| Follow-up messaging    | Continue conversation after tool call results   | ✅     | `input.messages` history passed as `messageHistory` automatically |
| Structured event types | Typed event payloads for all agent actions      | ✅     | `AGUIEvent` discriminated union with 16 event variants            |

---

## Multi-Modal Support

| Feature              | pydantic-ai                              | Status | Notes                                                                      |
| -------------------- | ---------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Image input to tools | Pass images into tool parameters         | ✅     | `binaryContentSchema` in tool `parameters`; `BinaryContent` in `execute`   |
| Audio / video input  | Audio and video as tool parameters       | ✅     | `BinaryContent` with audio/video MIME types; `isAudioContent()` type guard |
| Document input       | PDFs and documents as tool parameters    | ✅     | `BinaryContent` with `application/pdf` etc.; `isDocumentContent()` guard   |
| `UploadedFile`       | File reference for provider file uploads | ✅     | `UploadedFile` type + `uploadedFileSchema` + `uploadedFileToToolResult()`  |
| `BinaryImage` output | Agent returns a generated image          | ❌     | Not yet implemented as a dedicated output type                             |
