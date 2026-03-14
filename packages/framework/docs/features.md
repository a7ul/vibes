# Feature Parity: pydantic-ai → TypeScript Framework

This document tracks every pydantic-ai feature and its status in the TypeScript framework. Use it as a backlog when deciding what to port next.

**Legend:** ✅ Ported · 🚧 Partial · ❌ Not ported

---

## Agent API

| Feature                 | pydantic-ai                                     | Status | Notes                                                  |
| ----------------------- | ----------------------------------------------- | ------ | ------------------------------------------------------ |
| `agent.run()`           | `agent.run(prompt, deps=x)`                     | ✅     | `agent.run(prompt, { deps: x })`                       |
| `agent.run_stream()`    | `agent.run_stream(prompt)`                      | ✅     | `agent.stream(prompt)`                                 |
| Agent name              | `agent.name`                                    | ✅     | `name` on `AgentOptions`                               |
| System prompt (static)  | `system_prompt="..."`                           | ✅     | `systemPrompt: "..."`                                  |
| System prompt (dynamic) | `@agent.system_prompt` decorator                | ✅     | `agent.addSystemPrompt(fn)` or `systemPrompt: [fn]`    |
| Tools                   | `@agent.tool` / `tools=[...]`                   | ✅     | `agent.addTool(tool({...}))`                           |
| Structured output       | `result_type: BaseModel`                        | ✅     | `outputSchema: z.object({...})`                        |
| Result validators       | `@agent.result_validator`                       | ✅     | `agent.addResultValidator(fn)`                         |
| Max retries             | `max_retries` / `max_result_retries`            | ✅     | `maxRetries` on `AgentOptions`                         |
| Max turns               | `max_turns`                                     | ✅     | `maxTurns` on `AgentOptions`                           |
| Message history         | `message_history=`                              | ✅     | `{ messageHistory: [...] }` on `run()`                 |
| Sync run                | `agent.run_sync()`                              | ❌     | Deno is async-native — low priority                    |
| Event-stream run        | `agent.run_stream_events()`                     | ❌     | Returns async iterable of typed events                 |
| Node-level iteration    | `agent.iter()` / `AgentRun`                     | ❌     | Manual graph traversal step-by-step                    |
| End strategy            | `end_strategy`                                  | ❌     | Control when agent stops (e.g. on first tool result)   |
| Max concurrency         | `max_concurrency`                               | ❌     | Cap on parallel runs of the same agent                 |
| Metadata tagging        | `metadata=` on run                              | ❌     | Per-run tags for tracing/observability                 |
| `instructions` field    | `instructions=` (separate from `system_prompt`) | ❌     | pydantic-ai injects these differently per model        |
| Last run messages       | `agent.last_run_messages`                       | ❌     | Messages from the most recent run, accessible on agent |
| `Agent.override()`      | Context manager swapping model/deps/toolsets    | ❌     | Critical for testing without modifying call sites      |

---

## Tools

| Feature               | pydantic-ai                                     | Status | Notes                                                       |
| --------------------- | ----------------------------------------------- | ------ | ----------------------------------------------------------- |
| Tools with context    | `@agent.tool`                                   | ✅     | `tool({ execute: (ctx, args) => ... })`                     |
| Tool `maxRetries`     | `retries=` on `@agent.tool`                     | ✅     | `maxRetries` on `ToolDefinition`                            |
| Plain tools (no ctx)  | `@agent.tool_plain`                             | ❌     | No RunContext needed; simpler signature                     |
| Toolsets              | `toolsets=[...]` on Agent                       | ❌     | Group and reuse tool collections across agents              |
| Tool `prepare` method | `prepare=` on `Tool` class                      | ❌     | Fn called before each invocation to modify or skip the tool |
| Docstring extraction  | Auto-doc from Python docstrings                 | ❌     | Generate `description` + param docs from JSDoc              |
| Multi-modal returns   | Return images / audio / binary from tools       | ❌     | Tools currently must return JSON-serializable values        |
| Tool result metadata  | Attach metadata to tool results                 | ❌     | Pass extra info alongside tool output                       |
| Output functions      | Final-action tools (no model feedback loop)     | ❌     | Tool that ends the run instead of returning to model        |
| Deferred tools        | Tools requiring human approval before execution | ❌     | Human-in-the-loop pattern                                   |
| MCP server tools      | Connect external MCP servers as tool providers  | ❌     | Mount any MCP server as a tool source                       |

---

## Output & Structured Results

| Feature                     | pydantic-ai                          | Status | Notes                                                       |
| --------------------------- | ------------------------------------ | ------ | ----------------------------------------------------------- |
| Single schema output        | `result_type: BaseModel`             | ✅     | `outputSchema: z.object({...})` via `final_result` tool     |
| Result validators           | `@agent.result_validator`            | ✅     | `addResultValidator(fn)` — throw to retry                   |
| Union output types          | `output_type=[TypeA, TypeB]`         | ❌     | Multiple schemas, each registered as its own tool           |
| Native structured output    | `output_mode="native"`               | ❌     | Use model's native JSON mode instead of `final_result` tool |
| Prompted output mode        | `output_mode="prompted"`             | ❌     | Inject schema into instructions, no tool injection          |
| Streaming structured output | Partial validation as output streams | ❌     | Progressive Zod parse during streaming                      |
| `result.new_messages()`     | Messages added in _this_ run only    | ❌     | We only expose `result.messages` (full history)             |
| Message serialization       | `ModelMessagesTypeAdapter`           | ❌     | Serialize/deserialize messages to JSON for storage          |
| `result.all_messages()`     | Full message history                 | 🚧     | `result.messages` exists but no `new_messages()` split      |

---

## Message History

| Feature                   | pydantic-ai                                   | Status | Notes                                                                  |
| ------------------------- | --------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Pass history to next run  | `message_history=result.all_messages()`       | ✅     | `{ messageHistory: result.messages }`                                  |
| History processors        | `history_processors=[...]`                    | ❌     | Filter / summarize / transform history before each model call          |
| `new_messages()`          | Slice of messages from current run only       | ❌     | Needed to separate what was added vs what was passed in                |
| Cross-model compatibility | Messages work across providers                | ✅     | AI SDK `CoreMessage` is provider-agnostic                              |
| Message serialization     | JSON roundtrip via `ModelMessagesTypeAdapter` | ❌     | No serialization helpers; `CoreMessage` is serializable but no adapter |

---

## Usage & Limits

| Feature        | pydantic-ai                                 | Status | Notes                                                |
| -------------- | ------------------------------------------- | ------ | ---------------------------------------------------- |
| Usage tracking | `result.usage()`                            | ✅     | `result.usage` — prompt/completion tokens + requests |
| `UsageLimits`  | Cap tokens, requests, or tool calls per run | ❌     | Check usage in turn loop before calling model        |

---

## Testing

| Feature                      | pydantic-ai                                                       | Status | Notes                                                |
| ---------------------------- | ----------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| Mock model                   | `MockLanguageModelV1` (from `ai/test`)                            | ✅     | Equivalent to pydantic-ai's `TestModel`              |
| Multi-turn mock              | `mockValues(...)`                                                 | ✅     | Cycle through responses across turns                 |
| Stream mock                  | `convertArrayToReadableStream`                                    | ✅     | Build mock stream chunks                             |
| `TestModel`                  | Auto-generates valid structured data from schema, calls all tools | ❌     | Smarter than `MockLanguageModelV1` — schema-aware    |
| `FunctionModel`              | Custom function drives model responses                            | ❌     | Full control via user-supplied function              |
| `Agent.override()`           | Swap model/deps/toolsets in tests without modifying app code      | ❌     | Key pattern for integration testing                  |
| `capture_run_messages()`     | Context manager to inspect all model request/response objects     | ❌     | Debugging and assertion on raw model traffic         |
| `ALLOW_MODEL_REQUESTS=False` | Global flag to prevent accidental real API calls                  | ❌     | Test-safety guard; throw if non-test model is called |

---

## Multi-Agent

| Feature                  | pydantic-ai                              | Status | Notes                                         |
| ------------------------ | ---------------------------------------- | ------ | --------------------------------------------- |
| Agent-as-tool            | Pass an agent as a tool to another agent | ❌     | Parent agent delegates to child via tool call |
| Programmatic hand-off    | App code dispatches agents sequentially  | ❌     | Pattern, not framework code — but no helpers  |
| Graph-based control flow | `pydantic_graph` — typed state machine   | ❌     | Separate library; complex to port             |
| Usage aggregation        | Share `ctx.usage` across sub-agents      | ❌     | Aggregate cost across an agent tree           |

---

## Observability

| Feature             | pydantic-ai                             | Status | Notes                                                         |
| ------------------- | --------------------------------------- | ------ | ------------------------------------------------------------- |
| Logfire integration | Auto-traces runs, turns, and tool calls | ❌     | Would need a TS observability equivalent (e.g. OpenTelemetry) |
| Run-level spans     | Structured spans per run with metadata  | ❌     |                                                               |
| Tool-level spans    | Span per tool call with args and result | ❌     |                                                               |

---

## Porting Priority

### High value — port next

1. **`UsageLimits`** — production safety guard; check tokens/requests before each model call
2. **`Agent.override()`** — critical for testable integration patterns
3. **`capture_run_messages()`** — essential for debugging agent behaviour
4. **`result.new_messages()`** — needed for multi-turn conversation apps
5. **Union output types** — common real-world need; each member = separate `final_result` variant
6. **History processors** — required for long-running conversations (trim/summarize old turns)
7. **`ALLOW_MODEL_REQUESTS=False` equivalent** — prevent real API calls leaking into tests

### Medium value

8. **Plain tools** (`tool_plain`) — convenience; strip `ctx` from tool signatures when not needed
9. **Tool `prepare` method** — dynamic tool enabling/disabling per run
10. **Streaming structured output** — partial Zod parse during streaming
11. **Agent-as-tool** — foundation for multi-agent delegation

### Lower priority / complex

12. **MCP server tools** — depends on MCP client library availability in Deno
13. **Graph-based flow** — effectively a separate library (`pydantic_graph`)
14. **Logfire / OpenTelemetry** — observability layer; may be better handled outside the framework
15. **Native/prompted output modes** — AI SDK may expose model-native JSON mode directly
16. **Deferred tools** (human-in-the-loop) — requires external state and resumability
