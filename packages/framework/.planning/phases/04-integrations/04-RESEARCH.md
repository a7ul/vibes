# Phase 4: Integrations - Research

**Researched:** 2026-03-14
**Domain:** Documentation authoring - MCP, AG-UI, A2A, Temporal, Vercel AI UI integrations
**Confidence:** HIGH (all APIs verified directly from framework source code)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INT-01a | MCP Client page - `MCPToolset`, `MCPStdioClient`, `MCPHttpClient`, `MCPManager`, `loadMCPConfig`, architecture diagram | Full API verified in `lib/mcp/` source |
| INT-01b | MCP Server page - exposing a Vibes agent as an MCP server | No server-side MCP implementation exists in `lib/mcp/` - page must explain pattern using `@modelcontextprotocol/sdk` server directly |
| INT-02 | AG-UI page - fixed API (`deps`/`getState` not `depsFactory`), `AGUIAdapter.handleRequest()`, SSE event sequence diagram | API bug confirmed in existing ag-ui.mdx; correct API verified in `lib/ag_ui/adapter.ts` |
| INT-03 | A2A page - brand new, `A2AAdapter`, AgentCard, JSON-RPC endpoints, task lifecycle, streaming, task state machine Mermaid | Full API verified in `lib/a2a/adapter.ts` and `lib/a2a/types.ts` |
| INT-04 | Temporal page - rewrite with durable execution overview, `TemporalAgent`, `MockTemporalAgent`, workflow-activities diagram | API bugs confirmed in existing temporal.mdx; correct API in `lib/temporal/` |
| INT-05 | Vercel AI UI page - new page connecting Vibes agent stream to `useChat`/`useCompletion` React hooks | No framework-specific adapter; relies on Vercel AI SDK `toDataStreamResponse()` pattern |
</phase_requirements>

---

## Summary

Phase 4 creates or rewrites six integration documentation pages for the Vibes framework. All integrations have working implementations in the framework source code under `lib/`; the primary work is writing accurate documentation with architecture diagrams. The existing docs contain significant API inaccuracies - the old `ag-ui.mdx` uses `depsFactory` (which doesn't exist on `AGUIAdapterOptions`; the real API is `deps` and `getState`), the old `mcp.mdx` uses `manager.connectAll()`, `manager.toolset()`, `MCPManager([...])` constructor, and `MCPManager.fromConfig()` (none of which exist - the real API is `new MCPManager()`, `manager.addServer()`, `manager.connect()`), and the old `temporal.mdx` uses `temporalAgent.start()`, `workflowsPath()`, `activities()` as methods (they don't exist - real API is `temporalAgent.activities` property and `temporalAgent.workflowFn`).

The AG-UI, A2A, and Temporal pages need Mermaid sequence diagrams. The MCP Client page needs an architecture diagram showing the client-toolset-agent relationship. INT-01b (MCP Server page) is the only page requiring genuine research since there is no server-side MCP implementation in the framework - it uses `@modelcontextprotocol/sdk` server primitives directly.

**Primary recommendation:** Write directly from source code. Do not reference existing docs as truth - every API in existing docs is suspect. Verify each claim against `lib/` source before documenting.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vibes/framework` | current | All integration adapters | Framework being documented |
| `@modelcontextprotocol/sdk` | `^1` | MCP client transport (already in deno.json) | Official MCP SDK |
| `@temporalio/worker` | latest | Temporal worker process (Node.js only) | Official Temporal SDK |
| `@temporalio/workflow` | latest | Temporal workflow runtime (Node.js only) | Official Temporal SDK |
| `@temporalio/client` | latest | Starting Temporal workflows | Official Temporal SDK |
| `ai` (Vercel AI SDK) | `^6` | `toDataStreamResponse()` for Vercel AI UI | Already in deno.json |

### Mintlify Doc Components
| Component | Purpose |
|-----------|---------|
| `<Warning>` | Bug fix callout - highlight API corrections prominently |
| `<CodeGroup>` | Show before/after API correction |
| `<Tabs>` | stdio vs HTTP variants for MCP |
| `<Info>` | Node.js runtime constraint for Temporal |
| `mermaid` fences | Architecture and sequence diagrams |

---

## API Inventory (Verified from Source)

### MCP Client APIs (HIGH confidence - verified in `lib/mcp/`)

**`MCPStdioClient`** - `lib/mcp/mcp_stdio.ts`
- Constructor: `new MCPStdioClient(config: MCPStdioConfig, options?: { elicitationCallback? })`
- `MCPStdioConfig`: `{ command: string, args?: string[], env?: Record<string,string> }`
- Methods: `connect()`, `disconnect()`, `listTools()`, `callTool(name, args)`, `getServerInstructions()`

**`MCPHttpClient`** - `lib/mcp/mcp_http.ts`
- Constructor: `new MCPHttpClient(config: MCPHttpConfig, options?: { elicitationCallback? })`
- `MCPHttpConfig`: `{ url: string, headers?: Record<string,string> }`
- Methods: same interface as `MCPStdioClient`

**`MCPToolset`** - `lib/mcp/mcp_toolset.ts`
- Constructor: `new MCPToolset(client: MCPClient, options?: MCPToolsetOptions)`
- `MCPToolsetOptions`: `{ toolCacheTtlMs?: number, instructions?: boolean }`
- Methods: `tools(ctx)`, `getServerInstructions()`, `invalidateCache()`
- Default cache TTL: 60,000ms (1 minute)

**`MCPManager`** - `lib/mcp/mcp_manager.ts`
- Constructor: `new MCPManager()` - no arguments
- `addServer(client, options?)` - returns `this` (chainable), `options` includes `MCPToolsetOptions & { name?: string }`
- `connect()` - connects all registered servers in parallel
- `disconnect()` - disconnects all, throws `AggregateError` if any fail
- `tools(ctx)` - returns merged tools from all servers (last-wins on name collision)
- `getServerInstructions()` - aggregated instructions, prefixed with `[name]` if named
- `serverCount` property

**`loadMCPConfig`** / `createClientsFromConfig` / `createManagerFromConfig` - `lib/mcp/mcp_config.ts`
- `loadMCPConfig(path)` - reads JSON, supports array format OR `{ mcpServers: {...} }` Claude Desktop format, interpolates `${ENV_VAR}`
- `createClientsFromConfig(configs)` - creates clients, does NOT connect
- `createManagerFromConfig(path)` - convenience: load + create clients + add to manager + connect, returns connected `MCPManager`

**MCP Server (INT-01b)** - NO server implementation in framework
- The `@modelcontextprotocol/sdk` in `deno.json` only imports from `client/` paths
- INT-01b page must explain using `@modelcontextprotocol/sdk`'s `McpServer` class directly
- Pattern: create `McpServer`, register agent-powered tools, serve via stdio or HTTP

### AG-UI APIs (HIGH confidence - verified in `lib/ag_ui/adapter.ts`)

**`AGUIAdapter`** - correct API:
```ts
interface AGUIAdapterOptions<TDeps> {
  deps?: TDeps;                         // NOT depsFactory
  getState?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
}
```
- Constructor: `new AGUIAdapter(agent, options?)`
- `handleRequest(input: AGUIRunInput): Response` - takes `AGUIRunInput` object, NOT `Request`
- `handler(): (req: Request) => Promise<Response>` - returns a Deno HTTP handler that parses body

**BUG IN EXISTING DOCS:** `ag-ui.mdx` shows:
1. `depsFactory: (req) => ({...})` - WRONG. Real API: `deps: myDeps`
2. `adapter.handleRequest(req)` where `req` is a `Request` - WRONG. `handleRequest` takes `AGUIRunInput`, not `Request`; use `adapter.handler()` to get a Request handler

**`AGUIRunInput`**:
```ts
interface AGUIRunInput {
  threadId: string;
  runId?: string;
  messages: AGUIMessage[];
  state?: Record<string, unknown>;
}
```

**SSE Event sequence** (from adapter source):
1. `RUN_STARTED` (threadId, runId)
2. `STATE_SNAPSHOT` (if state provided in input OR from `getState`)
3. Per turn: `STEP_STARTED` (stepName: `turn-N`)
4. Per text chunk: `TEXT_MESSAGE_START` → `TEXT_MESSAGE_CONTENT` (delta) → `TEXT_MESSAGE_END`
5. Per tool call: `TOOL_CALL_START` → `TOOL_CALL_ARGS` → `TOOL_CALL_END`
6. On usage-update: `RAW` (usage) → `STEP_FINISHED`
7. On final-result: `TEXT_MESSAGE_END` (if open), `STATE_SNAPSHOT` (final state)
8. `RUN_FINISHED` (threadId, runId)
9. On error: `RUN_ERROR`

Full event type union in `lib/ag_ui/types.ts` includes: `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`, `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `STATE_SNAPSHOT`, `STATE_DELTA`, `MESSAGES_SNAPSHOT`, `RAW`, `STEP_STARTED`, `STEP_FINISHED`

### A2A APIs (HIGH confidence - verified in `lib/a2a/`)

**`A2AAdapter`** - `lib/a2a/adapter.ts`:
```ts
interface A2AAdapterOptions<TDeps> {
  name?: string;
  description?: string;
  url?: string;            // default: "http://localhost:8000"
  version?: string;        // default: "1.0.0"
  skills?: AgentCard["skills"];
  provider?: AgentCard["provider"];
  deps?: TDeps;
  taskStore?: TaskStore;   // default: MemoryTaskStore
}
```
- Constructor: `new A2AAdapter(agent, options?)`
- `handler()` - returns Deno HTTP handler
- `handleRequest(req: Request)` - routes to: `GET /.well-known/agent.json` or `POST /` (JSON-RPC)

**JSON-RPC methods supported:**
- `message/send` or `tasks/send` - synchronous task execution, returns full task
- `message/stream` or `tasks/sendSubscribe` - SSE streaming execution
- `tasks/get` - fetch task by ID
- `tasks/cancel` - cancel running task (signals abort to SSE stream)

**`AgentCard`** served at `GET /.well-known/agent.json`:
```ts
interface AgentCard {
  name: string;
  description?: string;
  url: string;
  version: string;
  capabilities: { streaming?: boolean, pushNotifications?: boolean, stateTransitionHistory?: boolean };
  skills: A2AAgentSkill[];
  provider?: { organization: string, url?: string };
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  documentationUrl?: string;
  iconUrl?: string;
}
```

**Task state machine** (from `A2ATaskState` union):
`submitted` → `working` → `completed` | `failed` | `canceled`
Also: `input-required` (for human-in-the-loop, not yet fully wired)

**`MemoryTaskStore`** - `lib/a2a/task_store.ts`
- In-memory implementation - no persistence across restarts
- Methods: `create(id, contextId, message)`, `update(id, status, opts?)`, `get(id)`

**A2A message parts** - discriminated union on `kind`:
- `{ kind: "text", text: string }`
- `{ kind: "file", file: { bytes?, uri?, mimeType?, name? } }`
- `{ kind: "data", data: Record<string,unknown> }`

**SSE events for `tasks/sendSubscribe`:**
- `{ kind: "status-update", taskId, contextId, status, final? }` - state transitions
- `{ kind: "artifact-update", taskId, contextId, artifact }` - streaming text chunks

### Temporal APIs (HIGH confidence - verified in `lib/temporal/`)

**`TemporalAgent`** - `lib/temporal/temporal_agent.ts`:
```ts
interface TemporalAgentOptions<TDeps> {
  taskQueue: string;
  modelCallActivity?: TemporalActivityOptions;
  toolCallActivity?: TemporalActivityOptions;
  depsFactory?: () => TDeps | Promise<TDeps>;   // NOTE: depsFactory exists HERE (not in AGUIAdapter)
}

interface TemporalActivityOptions {
  startToCloseTimeout?: string;  // e.g. "2m", "30s"
  retryPolicy?: {
    maximumAttempts?: number;
    initialInterval?: string;
    backoffCoefficient?: number;
  };
}
```
- Constructor: `new TemporalAgent(agent, options)`
- `activities` - **property**, not method: `{ runModelTurn: (params) => Promise<ModelTurnResult>, runToolCall: (params) => Promise<ToolCallResult> }`
- `workflowFn` - **property** (async function): `(prompt, opts?) => Promise<TOutput>`
- `run(prompt, opts?)` - non-Temporal fallback using `agent.run()` directly
- `agent` getter, `options` getter, `taskQueue` getter

**BUG IN EXISTING DOCS:** `temporal.mdx` shows:
1. `temporalAgent.start(client, { workflowId, args })` - method does NOT exist
2. `temporalAgent.workflowsPath()` - method does NOT exist
3. `temporalAgent.activities()` - method call, but it's a property: `temporalAgent.activities`
4. `Worker.create({ workflowsPath: temporalAgent.workflowsPath(), activities: temporalAgent.activities() })` - WRONG
5. `new MockTemporalAgent(agent)` without second argument - WRONG, constructor requires `options: TemporalAgentOptions<TDeps>` including `taskQueue`
6. `serializeAgentState`/`deserializeAgentState` - WRONG. Real exports: `serializeRunState`/`deserializeRunState`/`roundTripMessages`

**Correct worker setup pattern (from source docs in temporal_agent.ts):**
```ts
// In Node.js worker process
import { Worker } from "@temporalio/worker";
const worker = await Worker.create({
  taskQueue: "my-queue",
  activities: temporalAgent.activities,  // property, not method call
  // workflowsPath: require.resolve("./workflows"),  // user-provided workflow file
});
await worker.run();
```

**`MockTemporalAgent`** - `lib/temporal/mock_temporal.ts`:
- Constructor: `new MockTemporalAgent(agent, options: TemporalAgentOptions<TDeps>)` - requires `options`
- `run(prompt, opts?)` - executes agent, records activity history
- `simulateReplay(prompt, opts?)` - re-runs using cached results
- `getActivityHistory()` - returns `ReadonlyArray<ActivityHistoryEntry>`
- `reset()` - clears history and replay cache

**Serialization utilities** - `lib/temporal/serialization.ts`:
- `serializeRunState(messages: ModelMessage[]): SerializableMessage[]`
- `deserializeRunState(messages: SerializableMessage[]): ModelMessage[]`
- `roundTripMessages(messages: ModelMessage[]): ModelMessage[]`

**Node.js constraint (CRITICAL):** Temporal's workflow runtime requires Node.js. `TemporalAgent.activities` and `workflowFn` can be type-checked in Deno but must run in a Node.js process for actual Temporal workers. `MockTemporalAgent` works in Deno - use it for all tests.

### Vercel AI UI (INT-05) - Pattern-based, no framework adapter

There is no dedicated framework class for Vercel AI UI integration. The pattern is:
1. Create a Vibes agent, call `agent.stream()` or `agent.runStreamEvents()`
2. Convert the stream to Vercel AI SDK's `DataStreamResponse` format using `toDataStreamResponse()` from the `ai` package
3. `useChat` / `useCompletion` on the frontend connect to the API route

The `ai` package (v6) is already a dependency (`npm:ai@^6`). The integration docs should show the API route pattern + React hook usage.

---

## Architecture Patterns

### MCP Client Architecture Diagram
```
Agent
  └── MCPToolset (implements Toolset)
        └── MCPClient (interface)
              ├── MCPStdioClient → subprocess via stdio
              └── MCPHttpClient → remote server via HTTP/SSE

MCPManager (implements Toolset)
  ├── MCPToolset [server A]
  │     └── MCPStdioClient
  └── MCPToolset [server B]
        └── MCPHttpClient
```

### AG-UI Architecture Diagram
```
HTTP Client (CopilotKit / AG-UI frontend)
  │  POST /agent  {threadId, messages[]}
  ▼
AGUIAdapter.handler()
  │  parses AGUIRunInput, calls handleRequest(input)
  ▼
AGUIAdapter.handleRequest(input: AGUIRunInput)
  │  agent.runStreamEvents(prompt, { deps, messageHistory })
  ▼
ReadableStream<SSE events>
  → RUN_STARTED → [STEP_STARTED → TEXT/TOOL events → STEP_FINISHED] → STATE_SNAPSHOT → RUN_FINISHED
```

### A2A Architecture Diagram
```
Remote Agent / Client
  │  GET  /.well-known/agent.json       → AgentCard
  │  POST /  { method: "tasks/send" }   → A2ATask (sync)
  │  POST /  { method: "tasks/sendSubscribe" } → SSE stream
  │  POST /  { method: "tasks/get" }    → A2ATask
  │  POST /  { method: "tasks/cancel" } → A2ATask
  ▼
A2AAdapter
  ├── TaskStore (MemoryTaskStore)
  └── Agent
```

### Temporal Architecture Diagram
```
Client (any)
  └─ Temporal Client → schedules workflow execution
       └─ Temporal Server
            └─ Node.js Worker
                 ├── workflowFn (deterministic orchestration)
                 └── activities: { runModelTurn }
                                    └── TemporalAgent
                                          └── Agent.run()
```

### Vercel AI UI Architecture
```
React app (Next.js / Vite)
  useChat({ api: "/api/chat" })
  ↕  data stream protocol
Next.js / Deno API route
  agent.stream(prompt) → toDataStreamResponse()
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP server transport | Custom WebSocket/HTTP server | `@modelcontextprotocol/sdk` McpServer | Handles protocol negotiation, tool listing, JSON-RPC |
| SSE formatting | Manual `data: ...\n\n` | Already in `AGUIAdapter`/`A2AAdapter` | Edge cases: encoding, reconnection, chunking |
| Task state management | Custom Map with state machine | `MemoryTaskStore` | Already handles create/update/get with history |
| Temporal workflow file | New TypeScript module | `temporalAgent.workflowFn` | Already a valid Temporal workflow function |
| Vercel stream conversion | Manual stream adapter | `toDataStreamResponse()` from `ai` package | Handles all Vercel AI UI protocol details |

---

## Common Pitfalls

### Pitfall 1: AG-UI depsFactory (Known Bug)
**What goes wrong:** Using `depsFactory` option from existing docs - TypeScript error, option doesn't exist.
**Why it happens:** Old docs were written before API was finalized.
**How to avoid:** Use `deps: myDeps` for static deps. Use `getState` for state snapshot callback.
**Warning signs:** TypeScript error "Property 'depsFactory' does not exist on type 'AGUIAdapterOptions'"

### Pitfall 2: AG-UI handleRequest signature
**What goes wrong:** `adapter.handleRequest(req)` where `req: Request` - TypeScript error.
**Why it happens:** Old docs passed the raw HTTP Request to `handleRequest`.
**How to avoid:** For Deno HTTP servers, use `adapter.handler()` which returns a Deno-compatible handler. `handleRequest` takes `AGUIRunInput`, not `Request`.

### Pitfall 3: MCPManager API
**What goes wrong:** `new MCPManager([client1, client2])` / `manager.connectAll()` / `manager.toolset()` - all wrong.
**Why it happens:** Old docs described a different (non-existent) API.
**How to avoid:** Use `new MCPManager()` → `manager.addServer(client)` → `manager.connect()`. The manager itself IS the toolset (implements `Toolset` interface).

### Pitfall 4: Temporal - activities is a property, not a method
**What goes wrong:** `Worker.create({ activities: temporalAgent.activities() })` - TypeScript error.
**How to avoid:** `temporalAgent.activities` (no parentheses) - it's a property.

### Pitfall 5: Temporal - workflowsPath doesn't exist
**What goes wrong:** `temporalAgent.workflowsPath()` - method doesn't exist.
**Why it happens:** Old docs invented this method.
**How to avoid:** Users must provide their own workflow file path that re-exports `temporalAgent.workflowFn`. The `workflowFn` is a property that can be exported: `export const myWorkflow = temporalAgent.workflowFn`.

### Pitfall 6: MockTemporalAgent requires options
**What goes wrong:** `new MockTemporalAgent(agent)` - missing required second argument.
**How to avoid:** `new MockTemporalAgent(agent, { taskQueue: "test" })`.

### Pitfall 7: Temporal Node.js constraint
**What goes wrong:** Trying to run Temporal workers in Deno.
**How to avoid:** Always run `TemporalAgent` worker code in Node.js. Use `MockTemporalAgent` in Deno tests.

### Pitfall 8: MCP connect() required before use
**What goes wrong:** Creating `MCPStdioClient` or `MCPHttpClient` and using it without calling `connect()`.
**How to avoid:** Always `await client.connect()` before passing to `MCPToolset`. With `MCPManager`, `await manager.connect()` handles all clients.

### Pitfall 9: MCP disconnect() cleanup
**What goes wrong:** Subprocess MCP servers become orphaned when app exits without `disconnect()`.
**How to avoid:** Always call `await client.disconnect()` or `await manager.disconnect()` in a `finally` block.

---

## Code Examples

### INT-01a: MCP Client - Single stdio server
```typescript
// Source: lib/mcp/mcp_stdio.ts, lib/mcp/mcp_toolset.ts
import { Agent, MCPStdioClient, MCPToolset } from "npm:@vibes/framework";

const client = new MCPStdioClient({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
});

await client.connect();
const toolset = new MCPToolset(client);
const agent = new Agent({ model, toolsets: [toolset] });

try {
  const result = await agent.run("List files in /tmp");
  console.log(result.output);
} finally {
  await client.disconnect();
}
```

### INT-01a: MCP Client - Multiple servers via MCPManager
```typescript
// Source: lib/mcp/mcp_manager.ts, lib/mcp/mcp_config.ts
import { Agent, MCPHttpClient, MCPManager, MCPStdioClient } from "npm:@vibes/framework";

const manager = new MCPManager();
manager.addServer(
  new MCPStdioClient({ command: "npx", args: ["-y", "@mcp/filesystem", "/data"] }),
  { name: "filesystem" },
);
manager.addServer(
  new MCPHttpClient({ url: "https://search-mcp.example.com/mcp" }),
  { name: "search" },
);
await manager.connect();

const agent = new Agent({ model, toolsets: [manager] });
await agent.run("Search for docs and list /data/results");
await manager.disconnect();
```

### INT-01a: MCP Config file loading
```typescript
// Source: lib/mcp/mcp_config.ts
import { Agent, createManagerFromConfig } from "npm:@vibes/framework";

const manager = await createManagerFromConfig("./mcp.config.json");
const agent = new Agent({ model, toolsets: [manager] });
await agent.run("...");
await manager.disconnect();
```

Config file formats supported (both work):
```json
// Array format
[
  { "type": "stdio", "command": "npx", "args": ["-y", "my-server"] },
  { "type": "http", "url": "https://mcp.example.com" }
]
```
```json
// Claude Desktop format
{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "@mcp/filesystem", "/data"] },
    "remote": { "url": "https://mcp.example.com", "headers": { "Authorization": "Bearer ${API_KEY}" } }
  }
}
```

### INT-02: AG-UI - Correct API
```typescript
// Source: lib/ag_ui/adapter.ts
import { Agent, AGUIAdapter } from "npm:@vibes/framework";

const agent = new Agent({ model, systemPrompt: "You are helpful." });

// Static deps
const adapter = new AGUIAdapter(agent, {
  deps: { db: getDb(), userId: "system" },
  getState: () => ({ sessionActive: true }),
});

// Use adapter.handler() for Deno HTTP server
Deno.serve(adapter.handler());

// Or call handleRequest() directly with an AGUIRunInput object
const input: AGUIRunInput = {
  threadId: "thread-abc",
  messages: [{ role: "user", content: "Hello" }],
};
const response = adapter.handleRequest(input);
```

### INT-03: A2A - Setup and usage
```typescript
// Source: lib/a2a/adapter.ts
import { A2AAdapter, Agent } from "npm:@vibes/framework";

const agent = new Agent({ model, name: "Research Agent" });

const adapter = new A2AAdapter(agent, {
  name: "Research Agent",
  description: "Answers research questions",
  url: "https://my-agent.example.com",
  version: "1.0.0",
  skills: [{ id: "research", name: "Research", description: "Answer questions" }],
  deps: { db: getDb() },
});

Deno.serve(adapter.handler());
// GET  /.well-known/agent.json  → AgentCard
// POST /  (tasks/send)          → full task result
// POST /  (tasks/sendSubscribe) → SSE stream
```

### INT-04: Temporal - Correct API
```typescript
// Source: lib/temporal/temporal_agent.ts
import { Agent, TemporalAgent } from "npm:@vibes/framework";

const agent = new Agent({ model, systemPrompt: "You are a research assistant." });

const temporalAgent = new TemporalAgent(agent, {
  taskQueue: "research-queue",
  depsFactory: () => ({ db: getDb() }),
  modelCallActivity: { startToCloseTimeout: "2m" },
});

// In Node.js worker process:
// import { Worker } from "@temporalio/worker";
// const worker = await Worker.create({
//   taskQueue: temporalAgent.taskQueue,
//   activities: temporalAgent.activities,  // property, not method
//   workflowsPath: require.resolve("./workflows"),  // user exports workflowFn here
// });

// User's workflows.ts:
// export const researchWorkflow = temporalAgent.workflowFn;

// Start a workflow:
// const client = new Client({ connection: await Connection.connect() });
// const handle = await client.workflow.start(researchWorkflow, {
//   taskQueue: "research-queue",
//   workflowId: "research-001",
//   args: ["Summarize recent AI papers."],
// });
// const result = await handle.result();
```

### INT-04: Temporal - Testing with MockTemporalAgent
```typescript
// Source: lib/temporal/mock_temporal.ts
import { MockTemporalAgent } from "npm:@vibes/framework";

const mock = new MockTemporalAgent(agent, { taskQueue: "test" });
const result = await mock.run("What is 2+2?");
assertEquals(result.output, "4");

const history = mock.getActivityHistory();
assertEquals(history[0].activity, "runModelTurn");

mock.reset(); // clear between tests
```

---

## Page Structure Recommendations

### INT-01a: MCP Client Page (`integrations/mcp-client.mdx`)
1. What is MCP? (brief - architecture diagram showing client-toolset-agent)
2. `MCPStdioClient` - subprocess servers
3. `MCPHttpClient` - remote HTTP servers
4. `MCPToolset` - bridge to agent toolset interface (caching, server instructions)
5. `MCPManager` - multiple servers combined
6. Config file loading (`loadMCPConfig`, `createManagerFromConfig`)
7. Lifecycle (connect/disconnect, try/finally pattern)
8. API reference tables

### INT-01b: MCP Server Page (`integrations/mcp-server.mdx`)
1. What does "MCP server" mean? (expose agent as tool server for other AI clients)
2. Pattern: use `@modelcontextprotocol/sdk`'s `McpServer` directly
3. Agent-as-tool pattern: wrap `agent.run()` as an MCP tool
4. Stdio transport (for Claude Desktop integration)
5. HTTP transport (for remote access)
6. Note: no built-in framework class - this is user-land code using the MCP SDK

### INT-02: AG-UI Page (`integrations/ag-ui.mdx`)
1. What is AG-UI? (CopilotKit open protocol)
2. `AGUIAdapter` constructor - correct API (`deps`, `getState`, NOT `depsFactory`)
3. Deno HTTP server setup (`adapter.handler()`)
4. Direct usage (`adapter.handleRequest(input: AGUIRunInput)`)
5. `AGUIRunInput` shape
6. SSE event sequence diagram (Mermaid sequenceDiagram)
7. Multi-turn conversations
8. Warning callout about deprecated `depsFactory` if migrating old code
9. API reference

### INT-03: A2A Page (`integrations/a2a.mdx`) - brand new
1. What is A2A? (Google's open agent interop protocol)
2. `A2AAdapter` setup
3. AgentCard (`/.well-known/agent.json`) - discovery endpoint
4. JSON-RPC endpoints (`tasks/send`, `tasks/sendSubscribe`, `tasks/get`, `tasks/cancel`)
5. Task state machine diagram (Mermaid stateDiagram-v2)
6. Streaming with `tasks/sendSubscribe` (SSE events diagram)
7. `MemoryTaskStore` - in-memory, swap for persistent store in production
8. Agent skills configuration
9. API reference

### INT-04: Temporal Page (`integrations/temporal.mdx`)
1. What is durable execution? Why use Temporal?
2. How it works: workflow-activities architecture diagram
3. `TemporalAgent` - constructor, `activities` property, `workflowFn` property
4. Worker setup (Node.js only) - clear code showing correct pattern
5. Starting workflows (via Temporal client, not a framework method)
6. `MockTemporalAgent` - testing without Temporal server
7. Serialization helpers (`serializeRunState`, `deserializeRunState`)
8. Node.js constraint callout
9. API reference

### INT-05: Vercel AI UI Page (`integrations/vercel-ai-ui.mdx`) - brand new
1. What is Vercel AI UI? (`useChat`, `useCompletion` React hooks)
2. How streaming works end-to-end
3. API route: `agent.stream()` → `toDataStreamResponse()`
4. React frontend: `useChat({ api: "/api/chat" })`
5. `useCompletion` for single-turn completions
6. Next.js App Router example
7. Deno server example

---

## State of the Art

| Old Approach (in existing docs) | Correct Approach | Impact |
|---------------------------------|-----------------|--------|
| `AGUIAdapter({ depsFactory })` | `AGUIAdapter({ deps, getState })` | Type error with old approach |
| `adapter.handleRequest(req: Request)` | `adapter.handler()` for HTTP; `handleRequest(input: AGUIRunInput)` direct | Silent runtime failure with old approach |
| `new MCPManager([client1, client2])` | `new MCPManager(); manager.addServer(client)` | Constructor error with old approach |
| `manager.connectAll()` | `manager.connect()` | Runtime error with old approach |
| `manager.toolset()` | `manager` itself is the toolset | Runtime error with old approach |
| `MCPManager.fromConfig(config)` | `createManagerFromConfig(path)` | Import error with old approach |
| `temporalAgent.start(client, opts)` | User calls `client.workflow.start(temporalAgent.workflowFn, opts)` | Method doesn't exist |
| `temporalAgent.workflowsPath()` | User provides own workflow file exporting `temporalAgent.workflowFn` | Method doesn't exist |
| `temporalAgent.activities()` | `temporalAgent.activities` (property) | TypeError with old approach |
| `new MockTemporalAgent(agent)` | `new MockTemporalAgent(agent, { taskQueue: "test" })` | TypeScript error |
| `serializeAgentState` | `serializeRunState` | Import error |

---

## Open Questions

1. **INT-01b: MCP Server page scope**
   - What we know: No server-side MCP class exists in the framework
   - What's unclear: Does the team plan to add one soon? The requirement says "new capability docs" which implies something to document
   - Recommendation: Document the pattern using `@modelcontextprotocol/sdk`'s `McpServer` class directly, wrapping `agent.run()` as an MCP tool. Mark as "coming soon" if a framework class is planned.

2. **INT-05: Vercel AI UI data stream format**
   - What we know: Vercel AI SDK `ai@^6` is a dependency; `useChat` and `useCompletion` are the standard hooks
   - What's unclear: Does `agent.stream()` return a compatible stream directly, or does it require an intermediate conversion step?
   - Recommendation: Verify the `textStream` from `agent.stream()` can be piped into `toDataStreamResponse()` before writing examples. The Vercel AI SDK's `streamText` returns compatible types, but Vibes wraps this - check if `result.textStream` passes through directly.

3. **AG-UI `TOOL_CALL_ARGS` format**
   - What we know: The adapter emits args as a single delta (`JSON.stringify(event.args)`) rather than streaming args incrementally
   - What's unclear: Is this AG-UI spec compliant? The spec may expect incremental arg streaming
   - Recommendation: Document the current behavior as-is; note the single-chunk args behavior in the sequence diagram

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno test (built-in) |
| Config file | `deno.json` tasks key: `"test": "deno test -A"` |
| Quick run command | `deno test -A --filter="INT-"` (no test files for docs - N/A) |
| Full suite command | `deno test -A` |

### Phase Requirements → Test Map

This phase produces MDX documentation files only - no executable code. Tests are not applicable for documentation correctness in the traditional sense. Quality verification is done by:
- Code examples must compile (TypeScript check)
- All API references verified against source code (done in research)
- Mermaid diagrams render in Mintlify

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01a | MCP client docs accurate | Manual review | N/A (docs only) | ❌ Wave 0 |
| INT-01b | MCP server page created | Manual review | N/A (docs only) | ❌ Wave 0 |
| INT-02 | AG-UI API bug fixed in docs | Manual review | N/A (docs only) | ❌ Wave 0 |
| INT-03 | A2A page created | Manual review | N/A (docs only) | ❌ Wave 0 |
| INT-04 | Temporal page rewritten | Manual review | N/A (docs only) | ❌ Wave 0 |
| INT-05 | Vercel AI UI page created | Manual review | N/A (docs only) | ❌ Wave 0 |

### Wave 0 Gaps
- None - existing test infrastructure is not applicable to documentation tasks. All verification is source-code cross-referencing performed during authoring.

---

## Sources

### Primary (HIGH confidence)
- `lib/ag_ui/adapter.ts` - Full AG-UI adapter source, correct `AGUIAdapterOptions` interface
- `lib/ag_ui/types.ts` - Complete `AGUIEvent` union type
- `lib/a2a/adapter.ts` - Full A2A adapter source including all JSON-RPC handlers
- `lib/a2a/types.ts` - All A2A types: parts, messages, task states, AgentCard, JSON-RPC
- `lib/a2a/task_store.ts` - `MemoryTaskStore` and `TaskStore` interface
- `lib/mcp/mcp_client.ts` - `MCPClient` interface
- `lib/mcp/mcp_stdio.ts` - `MCPStdioClient` implementation
- `lib/mcp/mcp_http.ts` - `MCPHttpClient` implementation
- `lib/mcp/mcp_toolset.ts` - `MCPToolset` implementation
- `lib/mcp/mcp_manager.ts` - `MCPManager` implementation
- `lib/mcp/mcp_config.ts` - `loadMCPConfig`, `createClientsFromConfig`, `createManagerFromConfig`
- `lib/temporal/temporal_agent.ts` - `TemporalAgent` with `activities` property and `workflowFn` property
- `lib/temporal/mock_temporal.ts` - `MockTemporalAgent` requiring `TemporalAgentOptions`
- `lib/temporal/types.ts` - `TemporalAgentOptions`, `TemporalActivityOptions`, all Temporal types
- `lib/temporal/serialization.ts` - `serializeRunState`, `deserializeRunState`, `roundTripMessages`
- `deno.json` - dependency versions: `@modelcontextprotocol/sdk@^1`, `ai@^6`

### Secondary (MEDIUM confidence)
- `docs/reference/integrations/ag-ui.mdx` - existing docs showing API bugs to fix
- `docs/reference/integrations/mcp.mdx` - existing docs showing API bugs to fix
- `docs/reference/integrations/temporal.mdx` - existing docs showing API bugs to fix

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all APIs verified directly from TypeScript source
- Architecture: HIGH - verified from implementation code
- Pitfalls: HIGH - API bugs confirmed by comparing existing docs against source

**Research date:** 2026-03-14
**Valid until:** 90 days (stable, no fast-moving dependencies - APIs verified from source)
