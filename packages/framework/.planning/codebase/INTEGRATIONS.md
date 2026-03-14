# External Integrations

**Analysis Date:** 2026-03-14

## AI Model Providers

**Vercel AI SDK (`ai@^6`):**
- Purpose: Core model abstraction. All LLM calls are routed through `generateText` / `streamText` from the AI SDK.
- Usage: `lib/execution/run.ts`, `lib/execution/stream.ts`, `lib/execution/event_stream.ts`
- Model interface: `LanguageModel` from `ai` - callers pass any AI-SDK-compatible model instance (Anthropic, OpenAI, Gemini, etc.) to `AgentOptions.model`
- Auth: No credentials in this package. Model instances are constructed by the consumer (e.g. `anthropic("claude-3-5-sonnet")`, `openai("gpt-4o")`).
- Key AI SDK features used:
  - `generateText` / `streamText` with `tools`, `maxSteps`, `experimental_telemetry`, `providerOptions`
  - `Output` for native structured output (`outputMode: 'native'`)
  - `stepCountIs` stop condition
  - `ModelMessage` type for conversation history
  - `ai/test` subpath for `MockLanguageModelV1` in `lib/testing/`

**`@ai-sdk/provider@^3`:**
- Purpose: Low-level provider types used in model settings and tool definitions
- Usage: `lib/types/model_settings.ts`

## MCP (Model Context Protocol)

**SDK:** `@modelcontextprotocol/sdk@^1`

**Two transport modes:**

`MCPStdioClient` (`lib/mcp/mcp_stdio.ts`):
- Spawns a subprocess and communicates via stdin/stdout
- Config: `{ type: "stdio", command: string, args?: string[], env?: Record<string,string> }`
- Uses `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`

`MCPHttpClient` (`lib/mcp/mcp_http.ts`):
- Connects to a remote HTTP MCP server using Server-Sent Events (SSE streaming)
- Config: `{ type: "http", url: string, headers?: Record<string,string> }`
- Uses `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk/client/streamableHttp.js`
- Supports optional elicitation callbacks (MCP 1.x elicitation protocol)

**Config file loading** (`lib/mcp/mcp_config.ts`):
- Loads JSON config from file path (`loadMCPConfig`)
- Supports array format, single object, or Claude Desktop `{ mcpServers: {...} }` format
- Interpolates `${ENV_VAR}` references using `Deno.env`
- `createManagerFromConfig(path)` convenience: loads, creates clients, and returns a connected `MCPManager`

**MCPManager** (`lib/mcp/mcp_manager.ts`):
- Aggregates multiple MCP clients into a single `Toolset`
- Methods: `addServer`, `connect`, `disconnect`, `listTools`, `callTool`

**MCPToolset** (`lib/mcp/mcp_toolset.ts`):
- Adapts a single `MCPClient` into a framework `Toolset`
- Tools discovered via `listTools()` at runtime

## A2A (Agent-to-Agent Protocol)

**Implementation:** Custom - no external A2A SDK. Implements the Google A2A spec manually.

**`A2AAdapter`** (`lib/a2a/adapter.ts`):
- Wraps any framework `Agent` as an HTTP server responding to the A2A JSON-RPC protocol
- Endpoints:
  - `GET /.well-known/agent.json` - agent card discovery
  - `POST /` - JSON-RPC endpoint for `message/send`, `message/stream`, `tasks/send`, `tasks/sendSubscribe`, `tasks/get`, `tasks/cancel`
- Streaming responses use Server-Sent Events (SSE)
- Task state managed via pluggable `TaskStore` interface; default: `MemoryTaskStore` (`lib/a2a/task_store.ts`)
- Returns a Deno-compatible `(req: Request) => Promise<Response>` handler via `.handler()`
- Types: `lib/a2a/types.ts` - `A2ATask`, `A2AMessage`, `A2APart`, `AgentCard`, `A2ATaskState`, JSON-RPC envelopes

## AG-UI Protocol

**Implementation:** Custom - no external AG-UI SDK. Implements the CopilotKit AG-UI spec manually.

**`AGUIAdapter`** (`lib/ag_ui/adapter.ts`):
- Wraps any framework `Agent` to produce AG-UI Server-Sent Events responses
- Input: `AGUIRunInput` (`{ threadId, runId?, messages, state? }`)
- SSE event types emitted: `RUN_STARTED`, `STATE_SNAPSHOT`, `STEP_STARTED`, `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`, `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `STEP_FINISHED`, `RUN_FINISHED`, `RUN_ERROR`, `RAW`
- Returns a Deno-compatible handler via `.handler()` (POST endpoint)
- Types: `lib/ag_ui/types.ts` - `AGUIEvent` discriminated union

## OpenTelemetry (OTel)

**SDK:** `@opentelemetry/api@^1`

**Integration approach:** Delegates entirely to Vercel AI SDK's `experimental_telemetry` option on `generateText` / `streamText`. The framework does NOT create spans directly.

**`instrumentAgent`** (`lib/otel/instrumentation.ts`):
- Wraps an agent via `agent.override({ telemetry })` - no mutation
- Injects `TelemetrySettings` on every `run()` / `stream()` / `runStreamEvents()` call
- Options: `functionId`, `metadata`, `excludeContent` (maps to `recordInputs/recordOutputs: false`), `isEnabled`, `tracer`

**`withAgentSpan` / `recordRunAttributes` / `recordUsageAttributes`** (`lib/otel/spans.ts`):
- Utility functions for manual span management if needed

**Tracer resolution:** When no explicit `tracer` is provided, the AI SDK resolves one from the global OTel `TracerProvider`. Consumers must register a provider (e.g. `@opentelemetry/sdk-node`) in their own setup.

**Types:** `lib/otel/otel_types.ts` re-exports `TelemetrySettings` from `ai` and defines `InstrumentationOptions`.

## Temporal Durable Execution

**SDK:** `@temporalio/worker` + `@temporalio/workflow` - NOT bundled in this package. Must be installed by the consumer in a Node.js worker process.

**`TemporalAgent`** (`lib/temporal/temporal_agent.ts`):
- Wraps an `Agent` with Temporal activity-boundary semantics
- Exposes `activities` object (`runModelTurn`, `runToolCall`) for registration with `Worker.create({ activities })`
- Exposes `workflowFn` for registration with Temporal's workflow bundle
- `run()` provides a non-Temporal fallback for local dev/testing
- Node.js constraint: Temporal's workflow runtime requires a Node.js worker; this module can be type-checked from Deno

**`MockTemporalAgent`** (`lib/temporal/mock_temporal.ts`):
- Test double that records activity call history without requiring Temporal infrastructure

**Serialization** (`lib/temporal/serialization.ts`):
- `serializeRunState` / `deserializeRunState` - converts `ModelMessage[]` to JSON-safe format for Temporal payload boundaries
- `roundTripMessages` - test utility

**Types:** `lib/temporal/types.ts` - `TemporalAgentOptions`, `SerializableRunOptions`, `ModelTurnParams`, `ModelTurnResult`, `ToolCallParams`, `ToolCallResult`, `ActivityHistoryEntry`

## Graph / State Machine

**Implementation:** Built-in - no external FSM library.

**`Graph` / `GraphRun`** (`lib/graph/graph.ts`):
- Typed state machine where each node is a `BaseNode` subclass (`lib/graph/node.ts`)
- Nodes return `next(nextNodeId, state)` or `output(value)` to control transitions
- State persistence via pluggable `StatePersistence` interface
  - `MemoryStatePersistence` - in-memory snapshots
  - `FileStatePersistence` - persists snapshots to disk via `Deno.readTextFile` / `Deno.writeTextFile`
- `toMermaid()` (`lib/graph/mermaid.ts`) - generates Mermaid diagram source from graph definition

## Docs

**Platform:** Mintlify
- Config: `docs/docs.json` (schema: `https://mintlify.com/docs.json`)
- Theme: `mint`, dark mode default
- All pages as MDX files under `docs/`
- Published at GitHub repo: `https://github.com/a7ul/vibes`
- npm link: `https://www.npmjs.com/package/@vibes/framework`

## Webhooks & Callbacks

**Incoming:**
- A2A adapter handles: `POST /` (JSON-RPC), `GET /.well-known/agent.json`
- AG-UI adapter handles: `POST /` (SSE response)

**Outgoing:**
- MCP stdio: spawns subprocesses (tool servers)
- MCP HTTP: outbound SSE connections to MCP server URLs

## Data Storage

**Databases:** None. No database client in this package.

**File Storage:** `FileStatePersistence` in `lib/graph/persistence.ts` reads/writes graph state snapshots via `Deno.readTextFile` / `Deno.writeTextFile`.

**Caching:** None.

## Authentication & Identity

**Auth Provider:** None built-in. MCP HTTP client supports custom headers (for bearer tokens, etc.) via `MCPHttpConfig.headers`. A2A and AG-UI adapters expose raw `Request` objects - auth must be applied by the consumer's HTTP server layer.

## Monitoring & Observability

**Error Tracking:** None built-in.

**Logs:** No logging framework. Framework code uses no `console.log` in production paths.

**Traces:** OpenTelemetry via `@opentelemetry/api` + AI SDK `experimental_telemetry`. Consumers must configure and register an OTel SDK provider.

## CI/CD & Deployment

**Hosting:** Not applicable (library package).

**Publish target:** npm (`@vibes/framework`) - built to `npm/` via `deno task build:npm`, then `cd npm && npm publish --access public`.

---

*Integration audit: 2026-03-14*
