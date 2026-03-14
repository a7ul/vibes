# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** TypeScript agent framework built on top of the Vercel AI SDK (`ai@^6`). Inspired by pydantic-ai patterns ported to TypeScript. Provides a typed `Agent<TDeps, TOutput>` class as the primary abstraction, with pluggable tools, toolsets, history processors, and output modes.

**Key Characteristics:**
- Vercel AI SDK handles all model communication (`generateText`, `streamText`) — the framework orchestrates multi-turn loops around it
- Dependency injection via `RunContext<TDeps>` threads user-supplied deps into every tool and validator
- All output is typed via Zod schemas; three output modes (`tool`, `native`, `prompted`) handle how the schema is communicated to the model
- Protocol adapters (A2A, AG-UI) wrap the `Agent` class for external interoperability
- Graph FSM (`Graph` + `BaseNode`) is an optional layer for multi-step orchestration on top of agents

## Layers

**Public API Surface:**
- Purpose: Single re-export file consumed by library users
- Location: `mod.ts`
- Contains: Re-exports from all internal modules — `Agent`, tool factories, toolset classes, graph, adapters, MCP, OTel, Temporal
- Depends on: All `lib/` modules
- Used by: Package consumers (`@vibes/framework`)

**Agent Core:**
- Purpose: Defines the `Agent<TDeps, TOutput>` class and its configuration
- Location: `lib/agent.ts`
- Contains: `Agent` class, `AgentOptions`, `RunOptions`, `AgentOverrideOptions`, `EndStrategy`
- Depends on: `lib/execution/`, `lib/types/`, `lib/tool.ts`, `lib/toolsets/toolset.ts`
- Used by: All consumer code; adapters delegate to `agent.run()` / `agent.stream()` / `agent.runStreamEvents()`

**Execution Engine:**
- Purpose: Implements the multi-turn agent loop — resolves tools, calls the model, handles outputs, manages retries
- Location: `lib/execution/`
- Contains:
  - `run.ts` — `executeRun()`: non-streaming loop
  - `stream.ts` — `executeStream()`: returns `StreamResult<TOutput>` with `textStream` + `output` promise
  - `event_stream.ts` — `executeStreamEvents()`: `AsyncIterable<AgentStreamEvent<TOutput>>`
  - `_run_utils.ts` — shared helpers (`prepareTurn`, `resolveTools`, `buildToolMap`, `nudgeForFinalResult`, etc.)
  - `output_schema.ts` — `final_result` tool injection and schema prompt building
  - `deferred.ts` — `DeferredToolRequests` / `DeferredToolResult` for human-in-the-loop
- Depends on: Vercel AI SDK `generateText`/`streamText`, `lib/tool.ts`, `lib/toolsets/`, `lib/types/`, `lib/history/`
- Used by: `Agent` methods `run()`, `stream()`, `runStreamEvents()`

**Types:**
- Purpose: Shared TypeScript interfaces and error classes
- Location: `lib/types/`
- Contains:
  - `context.ts` — `RunContext<TDeps>`, `Usage`
  - `results.ts` — `RunResult<TOutput>`, `StreamResult<TOutput>`, `ResultValidator`
  - `events.ts` — `AgentStreamEvent<TOutput>` discriminated union
  - `errors.ts` — `ApprovalRequiredError`, `MaxTurnsError`, `MaxRetriesError`
  - `output_mode.ts` — `OutputMode` (`'tool' | 'native' | 'prompted'`)
  - `model_settings.ts` — `ModelSettings`
  - `usage_limits.ts` — `UsageLimits`
- Depends on: Nothing internal (pure types)
- Used by: Everything

**Tool Layer:**
- Purpose: Defines `ToolDefinition<TDeps>` and factory functions for creating tools
- Location: `lib/tool.ts`
- Contains: `tool()`, `plainTool()`, `fromSchema()`, `outputTool()`, `toAISDKTools()`
- Depends on: `lib/types/context.ts`, `lib/concurrency.ts`, Vercel AI SDK `tool`/`jsonSchema`
- Used by: `lib/execution/`, consumers building tools

**Toolsets:**
- Purpose: Composable collections of tools resolved per model turn
- Location: `lib/toolsets/`
- Contains:
  - `toolset.ts` — `Toolset<TDeps>` interface (single `tools(ctx)` method)
  - `function_toolset.ts` — `FunctionToolset` wraps a function returning tools
  - `combined_toolset.ts` — `CombinedToolset` merges multiple toolsets
  - `filtered_toolset.ts` — `FilteredToolset` includes/excludes by name
  - `prefixed_toolset.ts` — `PrefixedToolset` / `RenamedToolset` namespaces tool names
  - `prepared_toolset.ts` — `PreparedToolset` injects a prepared value via `prepare()`
  - `wrapper_toolset.ts` — `WrapperToolset` middleware-style interception around tool calls
  - `approval_required_toolset.ts` — `ApprovalRequiredToolset` marks all tools as approval-required
  - `external_toolset.ts` — `ExternalToolset` for tools defined without Zod schemas
- Depends on: `lib/types/context.ts`, `lib/tool.ts`
- Used by: Agent constructor, `resolveTools()` in execution engine

**History:**
- Purpose: Transform message history before each model turn
- Location: `lib/history/`
- Contains:
  - `processor.ts` — `HistoryProcessor<TDeps>` type + `trimHistoryProcessor`, `tokenTrimHistoryProcessor`, `summarizeHistoryProcessor`, `privacyFilterProcessor`
  - `serialization.ts` — `serializeMessages` / `deserializeMessages`
- Depends on: `lib/types/context.ts`, Vercel AI SDK
- Used by: `prepareTurn()` in execution engine; `historyProcessors` option on `Agent`

**Graph FSM:**
- Purpose: Multi-agent typed state machine for complex multi-step orchestration
- Location: `lib/graph/`
- Contains:
  - `node.ts` — `BaseNode<TState, TOutput>` abstract class with `id` and `run(state)` → `NodeResult`
  - `graph.ts` — `Graph<TState, TOutput>` (holds node map) + `GraphRun` (step iterator)
  - `types.ts` — `NodeResult`, `NodeId`, `GraphSnapshot`
  - `persistence.ts` — `StatePersistence` interface + `MemoryStatePersistence` + `FileStatePersistence`
  - `mermaid.ts` — `toMermaid()` for diagram generation
  - `errors.ts` — `MaxGraphIterationsError`, `UnknownNodeError`
- Depends on: Nothing internal beyond `lib/graph/types.ts` (Graph is self-contained)
- Used by: Consumers building orchestration workflows; exported via `mod.ts`

**Protocol Adapters:**
- Purpose: Expose the agent via external wire protocols
- Location: `lib/a2a/`, `lib/ag_ui/`
- Contains:
  - `lib/a2a/adapter.ts` — `A2AAdapter` (JSON-RPC + SSE, Google A2A protocol)
  - `lib/a2a/task_store.ts` — `TaskStore` interface + `MemoryTaskStore`
  - `lib/ag_ui/adapter.ts` — `AGUIAdapter` (SSE, AG-UI protocol)
- Depends on: `Agent`, `lib/multimodal/`
- Used by: Server-side deployments exposing agents to multi-agent systems or UIs

**MCP Integration:**
- Purpose: Consume tools from Model Context Protocol servers
- Location: `lib/mcp/`
- Contains:
  - `mcp_client.ts` — `MCPClient` interface
  - `mcp_http.ts` — `MCPHttpClient`
  - `mcp_stdio.ts` — `MCPStdioClient`
  - `mcp_manager.ts` — `MCPManager` (multi-server)
  - `mcp_toolset.ts` — `MCPToolset` (implements `Toolset<TDeps>`)
  - `mcp_config.ts` — `loadMCPConfig`, `createClientsFromConfig`, `createManagerFromConfig`
- Depends on: `@modelcontextprotocol/sdk`, `lib/toolsets/toolset.ts`
- Used by: Agents that consume external tool servers

**Observability:**
- Purpose: OpenTelemetry instrumentation
- Location: `lib/otel/`
- Contains: `instrumentation.ts` (`instrumentAgent`, `createTelemetrySettings`), `spans.ts` (span helpers), `otel_types.ts`
- Depends on: `@opentelemetry/api`

**Temporal Integration:**
- Purpose: Durable execution via Temporal workflow engine
- Location: `lib/temporal/`
- Contains: `temporal_agent.ts` (`TemporalAgent`), `mock_temporal.ts`, `serialization.ts`, `types.ts`

**Testing Utilities:**
- Purpose: Test doubles for model and run capture
- Location: `lib/testing/`
- Contains:
  - `test_model.ts` — `TestModel` (scripted responses)
  - `function_model.ts` — `FunctionModel` (callback-based)
  - `mod.ts` — `captureRunMessages`, `setAllowModelRequests`, `getAllowModelRequests`, `createTestModel`

**Multimodal:**
- Purpose: Binary content (images, audio, video, files) helpers
- Location: `lib/multimodal/`
- Contains: `binary_content.ts` (type guards, serialization), `content.ts` (user message part helpers)

## Data Flow

**Standard Agent Run (`agent.run(prompt)`):**

1. `Agent.run()` calls `executeRun()` in `lib/execution/run.ts`
2. `createRunContext()` builds `RunContext<TDeps>` with deps, UUID, usage counters
3. `resolveSystemPrompt()` evaluates static or dynamic system prompt (once per run)
4. Loop starts (up to `maxTurns`):
   a. `prepareTurn()` resolves tools (calling `prepare()` on each, flattening toolsets), applies history processors, resolves per-turn instructions
   b. `buildToolMap()` converts `ToolDefinition[]` to Vercel AI SDK `ToolSet`; registers `final_result` tool if output mode is `'tool'`
   c. `generateText()` (Vercel AI SDK) is called with model, system, messages, tools
   d. If approval-required tools triggered, throw `ApprovalRequiredError` with `DeferredToolRequests`
   e. If `final_result` / output tool result found, run `resultValidators`, return `RunResult<TOutput>`
   f. If text response (no schema), return `RunResult<TOutput>` immediately
   g. Otherwise push new messages onto history, continue loop
5. Throw `MaxTurnsError` if loop exhausts

**Human-in-the-Loop Resume:**

1. `agent.run()` throws `ApprovalRequiredError` containing `DeferredToolRequests`
2. Caller inspects `err.deferred.requests`, supplies approved results
3. `agent.resume(deferred, results)` calls `executeRun()` with `_resumeFromDeferred: true` and the full prior message history
4. `buildResumeToolMessage()` injects approved tool results into message history
5. Run loop continues normally from that point

**Streaming (`agent.stream()` / `agent.runStreamEvents()`):**

- `stream()` returns `StreamResult<TOutput>` synchronously with lazy `textStream` and `output` promise
- `runStreamEvents()` returns `AsyncIterable<AgentStreamEvent<TOutput>>` — events: `turn-start`, `text-delta`, `partial-output`, `tool-call-start`, `tool-call-result`, `usage-update`, `final-result`, `error`

**Graph Execution:**

1. `new Graph([...nodes])` registers `BaseNode` instances by their `id`
2. `graph.run(initialState, "start-node-id")` loops: `node.run(state)` → `next(nodeId, newState)` or `output(value)`
3. `graph.runIter()` returns `GraphRun` for step-by-step control; each `run.next()` executes one node
4. `StatePersistence` is called after each transition and cleared on completion

**State Management:**
- `RunContext` is mutable but scoped to a single run — not shared across runs
- Message history is an immutable array rebuilt each turn (`[...messages, ...newMessages]`)
- Tool results metadata accumulated in `ctx.toolResultMetadata` Map

## Key Abstractions

**`Agent<TDeps, TOutput>`:**
- Purpose: Central class users instantiate; holds all configuration
- Location: `lib/agent.ts`
- Pattern: Configuration object pattern; exposes `run()`, `stream()`, `runStreamEvents()`, `resume()`, `override()`
- Generic params: `TDeps` = dependency injection type, `TOutput` = output type (default `string`)

**`RunContext<TDeps>`:**
- Purpose: Thread-local context passed to every tool execute and result validator
- Location: `lib/types/context.ts`
- Fields: `deps`, `usage`, `retryCount`, `toolName`, `runId`, `metadata`, `toolResultMetadata`, `attachMetadata()`

**`Toolset<TDeps>` interface:**
- Purpose: Per-turn composable tool group
- Location: `lib/toolsets/toolset.ts`
- Pattern: Single method `tools(ctx: RunContext<TDeps>)` returning `ToolDefinition[]` — resolved fresh every turn

**`ToolDefinition<TDeps>`:**
- Purpose: Describes a single callable tool
- Location: `lib/tool.ts`
- Key fields: `name`, `description`, `parameters` (ZodType), `execute(ctx, args)`, `prepare(ctx)`, `argsValidator`, `isOutput`, `sequential`, `requiresApproval`

**`BaseNode<TState, TOutput>`:**
- Purpose: Abstract FSM node for Graph orchestration
- Location: `lib/graph/node.ts`
- Pattern: Extend and implement `id: NodeId` and `run(state: TState): Promise<NodeResult<TState, TOutput>>`; return `next(nodeId, newState)` or `output(value)`

**`HistoryProcessor<TDeps>`:**
- Purpose: Transform messages before each model call (trim, summarize, redact)
- Location: `lib/history/processor.ts`
- Pattern: Pure function `(messages, ctx) => messages | Promise<messages>`; chained in order

**`ResultValidator<TDeps, TOutput>`:**
- Purpose: Post-processing and validation of structured output
- Location: `lib/types/results.ts`
- Pattern: `(ctx, output) => output | Promise<output>` — throw to reject and retry

## Entry Points

**`mod.ts` (Library Entry):**
- Location: `mod.ts`
- Triggers: `import { Agent, tool, ... } from "@vibes/framework"`
- Responsibilities: Re-exports all public API symbols

**`Agent.run()` (Non-streaming):**
- Location: `lib/agent.ts` → `lib/execution/run.ts`
- Triggers: `await agent.run(prompt, opts?)`
- Responsibilities: Manages the full multi-turn loop; returns `Promise<RunResult<TOutput>>`

**`Agent.stream()` (Streaming):**
- Location: `lib/agent.ts` → `lib/execution/stream.ts`
- Triggers: `agent.stream(prompt, opts?)`
- Responsibilities: Returns `StreamResult` synchronously; `textStream` and `output` are lazy async iterables

**`Agent.runStreamEvents()` (Event stream):**
- Location: `lib/agent.ts` → `lib/execution/event_stream.ts`
- Triggers: `agent.runStreamEvents(prompt, opts?)`
- Responsibilities: Yields typed `AgentStreamEvent<TOutput>` — consumed by protocol adapters (AG-UI, A2A)

**`A2AAdapter.handler()` (A2A protocol):**
- Location: `lib/a2a/adapter.ts`
- Triggers: HTTP request to JSON-RPC endpoint (`POST /`) or agent card endpoint (`GET /.well-known/agent.json`)
- Responsibilities: Google A2A protocol — task lifecycle management (create, stream, cancel), SSE streaming

**`AGUIAdapter.handler()` (AG-UI protocol):**
- Location: `lib/ag_ui/adapter.ts`
- Triggers: `POST /` with `AGUIRunInput` body
- Responsibilities: Translates `runStreamEvents()` into AG-UI SSE events

## Error Handling

**Strategy:** Errors are typed and thrown — no result types or monads.

**Patterns:**
- `MaxTurnsError` thrown when `maxTurns` exceeded (from `lib/types/errors.ts`)
- `MaxRetriesError` thrown when output validation retries exhausted
- `ApprovalRequiredError` thrown (not a real error) to pause a run awaiting human approval — caught and resumed via `agent.resume()`
- Tool execute retries: `t.maxRetries` controls per-tool retry count before propagating
- Nudge pattern: When output tool not called, inject a user message asking the model to use `final_result`, increment `ctx.retryCount`

## Cross-Cutting Concerns

**Logging:** None built-in — relies on OTel instrumentation (`lib/otel/`) via `experimental_telemetry` in Vercel AI SDK calls.

**Validation:** Zod schemas for tool parameters and output. `argsValidator` per tool for cross-field validation. `resultValidators` array on agent for post-parse validation.

**Authentication:** Not handled in framework — delegated to provider credentials (Vercel AI SDK model instances) and user-supplied `deps`.

**Concurrency:** `Semaphore` (`lib/concurrency.ts`) used for `maxConcurrency` (concurrent tool executions per turn) and `sequential` tool mutex (run-scoped).

---

*Architecture analysis: 2026-03-14*
