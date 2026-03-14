# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
packages/framework/
├── mod.ts                        # Public API - single re-export barrel
├── deno.json                     # Package manifest, import map, tasks
├── README.md                     # Project readme
├── docs_parity.md                # Parity tracker vs Pydantic AI (✅/⚠️/❌)
│
├── lib/                          # All implementation code
│   ├── agent.ts                  # Agent class + AgentOptions, RunOptions
│   ├── tool.ts                   # tool(), plainTool(), fromSchema(), outputTool(), toAISDKTools()
│   ├── concurrency.ts            # Semaphore for maxConcurrency + sequential tools
│   │
│   ├── types/                    # Shared TypeScript types (no logic)
│   │   ├── context.ts            # RunContext<TDeps>, Usage
│   │   ├── results.ts            # RunResult, StreamResult, ResultValidator
│   │   ├── events.ts             # AgentStreamEvent discriminated union
│   │   ├── errors.ts             # MaxTurnsError, MaxRetriesError, ApprovalRequiredError
│   │   ├── output_mode.ts        # OutputMode type ('tool' | 'native' | 'prompted')
│   │   ├── model_settings.ts     # ModelSettings
│   │   ├── usage_limits.ts       # UsageLimits + checkUsageLimits()
│   │   └── mod.ts                # Re-exports from types/
│   │
│   ├── execution/                # Multi-turn run loop
│   │   ├── run.ts                # executeRun() - non-streaming
│   │   ├── stream.ts             # executeStream() - StreamResult
│   │   ├── event_stream.ts       # executeStreamEvents() - AsyncIterable<AgentStreamEvent>
│   │   ├── _run_utils.ts         # Shared helpers: prepareTurn, resolveTools, buildToolMap, nudge*
│   │   ├── output_schema.ts      # final_result tool injection, schema prompt building
│   │   └── deferred.ts           # DeferredToolRequests, DeferredToolResult (human-in-the-loop)
│   │
│   ├── toolsets/                 # Composable tool collections
│   │   ├── toolset.ts            # Toolset<TDeps> interface
│   │   ├── function_toolset.ts   # FunctionToolset
│   │   ├── combined_toolset.ts   # CombinedToolset
│   │   ├── filtered_toolset.ts   # FilteredToolset
│   │   ├── prefixed_toolset.ts   # PrefixedToolset, RenamedToolset
│   │   ├── prepared_toolset.ts   # PreparedToolset
│   │   ├── wrapper_toolset.ts    # WrapperToolset (middleware)
│   │   ├── approval_required_toolset.ts  # ApprovalRequiredToolset
│   │   ├── external_toolset.ts   # ExternalToolset (non-Zod schemas)
│   │   └── mod.ts                # Re-exports
│   │
│   ├── history/                  # Message history processing
│   │   ├── processor.ts          # HistoryProcessor type + built-in processors
│   │   ├── serialization.ts      # serializeMessages / deserializeMessages
│   │   └── mod.ts                # Re-exports
│   │
│   ├── graph/                    # Graph FSM (multi-agent state machine)
│   │   ├── node.ts               # BaseNode<TState, TOutput> abstract class
│   │   ├── graph.ts              # Graph + GraphRun classes
│   │   ├── types.ts              # NodeResult, NodeId, GraphSnapshot, etc.
│   │   ├── persistence.ts        # StatePersistence + Memory/FileStatePersistence
│   │   ├── mermaid.ts            # toMermaid() diagram generation
│   │   ├── errors.ts             # MaxGraphIterationsError, UnknownNodeError
│   │   └── mod.ts                # Re-exports
│   │
│   ├── a2a/                      # Agent-to-Agent protocol adapter
│   │   ├── adapter.ts            # A2AAdapter class
│   │   ├── task_store.ts         # TaskStore interface + MemoryTaskStore
│   │   ├── types.ts              # A2A protocol types (tasks, messages, artifacts)
│   │   └── mod.ts                # Re-exports
│   │
│   ├── ag_ui/                    # AG-UI protocol adapter
│   │   ├── adapter.ts            # AGUIAdapter class
│   │   ├── types.ts              # AGUIEvent discriminated union
│   │   └── mod.ts                # Re-exports
│   │
│   ├── mcp/                      # Model Context Protocol integration
│   │   ├── mcp_client.ts         # MCPClient interface
│   │   ├── mcp_http.ts           # MCPHttpClient (Streamable HTTP transport)
│   │   ├── mcp_stdio.ts          # MCPStdioClient (stdio transport)
│   │   ├── mcp_manager.ts        # MCPManager (multi-server)
│   │   ├── mcp_toolset.ts        # MCPToolset (implements Toolset)
│   │   ├── mcp_config.ts         # loadMCPConfig, createClientsFromConfig
│   │   ├── mcp_types.ts          # MCP protocol types
│   │   └── mod.ts                # Re-exports
│   │
│   ├── otel/                     # OpenTelemetry instrumentation
│   │   ├── instrumentation.ts    # instrumentAgent(), createTelemetrySettings()
│   │   ├── spans.ts              # withAgentSpan, recordRunAttributes, recordUsageAttributes
│   │   ├── otel_types.ts         # InstrumentationOptions, TelemetrySettings
│   │   └── mod.ts                # Re-exports
│   │
│   ├── temporal/                 # Temporal durable execution integration
│   │   ├── temporal_agent.ts     # TemporalAgent class
│   │   ├── mock_temporal.ts      # MockTemporalAgent for testing
│   │   ├── serialization.ts      # serializeRunState, deserializeRunState, roundTripMessages
│   │   ├── types.ts              # Temporal-specific types
│   │   └── mod.ts                # Re-exports
│   │
│   ├── multimodal/               # Binary content and multi-modal helpers
│   │   ├── binary_content.ts     # BinaryContent types, type guards, serialization
│   │   ├── content.ts            # imageMessage, audioMessage, fileMessage helpers
│   │   └── mod.ts                # Re-exports
│   │
│   └── testing/                  # Test utilities
│       ├── test_model.ts         # TestModel (scripted responses)
│       ├── function_model.ts     # FunctionModel (callback-based)
│       └── mod.ts                # captureRunMessages, setAllowModelRequests, etc.
│
├── tests/                        # All test files (co-located by feature name)
│   ├── _helpers.ts               # Shared test helpers
│   ├── agent_test.ts
│   ├── graph_test.ts
│   ├── toolsets_test.ts
│   └── ...                       # One *_test.ts per feature area
│
├── docs/                         # Mintlify documentation (MDX)
│   ├── docs.json                 # Mintlify nav config
│   ├── index.mdx                 # Landing page
│   ├── getting-started/          # Install, first agent, tools, structured output, testing
│   ├── concepts/                 # How agents work, DI, error handling
│   ├── guides/                   # Human-in-the-loop, multi-agent systems
│   └── reference/
│       ├── core/                 # agents, tools, toolsets, structured-output, streaming, etc.
│       ├── advanced/             # message-history, deferred-tools, multi-modal, etc.
│       └── integrations/         # mcp, graph, ag-ui, otel, temporal
│
└── scripts/
    └── build_npm.ts              # Deno → npm build script
```

## Directory Purposes

**`lib/`:**
- Purpose: All framework implementation; nothing in `lib/` is a test file
- Contains: All `*.ts` source files organized by feature module
- Key entry: `lib/agent.ts` is the heart; `lib/execution/` is the engine

**`lib/execution/`:**
- Purpose: The multi-turn agent loop - the most critical directory in the framework
- Contains: Three loop variants (`run.ts`, `stream.ts`, `event_stream.ts`) + shared utilities
- Key note: `_run_utils.ts` (underscore prefix = internal) contains all shared per-turn logic; `output_schema.ts` manages how structured output is communicated

**`lib/toolsets/`:**
- Purpose: Composable tool group abstractions
- Contains: Eight concrete toolset implementations + the `Toolset<TDeps>` interface
- Key note: All toolsets implement a single-method interface `tools(ctx)` - they are resolved fresh every turn

**`lib/types/`:**
- Purpose: Pure TypeScript types shared across the framework - no business logic
- Contains: Interfaces and type aliases only; types are imported broadly throughout `lib/`

**`lib/graph/`:**
- Purpose: Optional FSM layer for complex multi-agent workflows - independent of the core agent loop
- Contains: Self-contained; `Graph` + `BaseNode` + persistence + Mermaid export

**`lib/a2a/` and `lib/ag_ui/`:**
- Purpose: Protocol adapters that expose an `Agent` via standard agent interop protocols
- Contains: HTTP handlers, SSE event serializers, protocol type definitions

**`tests/`:**
- Purpose: All Deno test files - flat directory, one file per feature area
- Naming: `{feature}_test.ts` pattern (e.g., `graph_test.ts`, `toolsets_test.ts`)
- Key file: `_helpers.ts` provides shared test utilities

**`docs/`:**
- Purpose: Mintlify MDX documentation site
- Contains: Navigation configured in `docs.json`; content in `.mdx` files
- Key file: `docs_parity.md` (project root, not in `docs/`) tracks what docs exist vs. what's missing vs. Pydantic AI

## Key File Locations

**Entry Points:**
- `mod.ts`: Public library entry - all exports consumers use
- `lib/agent.ts`: `Agent` class definition
- `lib/execution/run.ts`: `executeRun()` - the non-streaming loop
- `lib/execution/stream.ts`: `executeStream()` - streaming loop
- `lib/execution/event_stream.ts`: `executeStreamEvents()` - event stream loop

**Configuration:**
- `deno.json`: Package name (`@vibes/framework`), version, import map, tasks
- `docs/docs.json`: Mintlify navigation structure

**Core Logic:**
- `lib/execution/_run_utils.ts`: `prepareTurn()`, `resolveTools()`, `buildToolMap()` - shared by all three execution paths
- `lib/execution/output_schema.ts`: `final_result` tool registration and schema prompt injection
- `lib/execution/deferred.ts`: Human-in-the-loop pause/resume data structures
- `lib/tool.ts`: `toAISDKTools()` - converts framework tool definitions to Vercel AI SDK format

**Testing:**
- `lib/testing/mod.ts`: `TestModel`, `FunctionModel`, `captureRunMessages`, `setAllowModelRequests`
- `tests/_helpers.ts`: Shared test helpers
- `tests/agent_test.ts`: Core agent behavior tests

## Naming Conventions

**Files:**
- Snake_case for implementation files: `agent.ts`, `run.ts`, `function_toolset.ts`, `mcp_config.ts`
- `mod.ts` as the re-export barrel for each directory (not `index.ts`)
- `_run_utils.ts` underscore prefix signals internal-only (not part of public API)
- Test files: `{feature}_test.ts` in `tests/`

**Directories:**
- Lowercase, snake_case: `ag_ui`, `mcp`, `a2a`, `otel`
- Organized by integration / feature area, not by type (no `interfaces/`, `utils/`)

**TypeScript:**
- Generic parameters: `TDeps`, `TOutput`, `TState` (PascalCase with `T` prefix)
- Types/interfaces: PascalCase (`RunContext`, `ToolDefinition`, `AgentOptions`)
- Functions: camelCase (`executeRun`, `prepareTurn`, `resolveTools`)
- Constants: camelCase or UPPER_SNAKE_CASE (`FINAL_RESULT_TOOL`, `DEFAULT_MAX_MESSAGES`)

## Where to Add New Code

**New tool factory function:**
- Implementation: `lib/tool.ts` (alongside `tool()`, `plainTool()`, `fromSchema()`, `outputTool()`)
- Export: Add to `mod.ts`
- Test: `tests/plain_tool_test.ts` pattern

**New toolset type:**
- Implementation: `lib/toolsets/{name}_toolset.ts`
- Re-export: Add to `lib/toolsets/mod.ts`
- Export from public API: Add to `mod.ts`
- Test: `tests/toolsets_test.ts` or new `tests/{name}_toolset_test.ts`

**New history processor:**
- Implementation: `lib/history/processor.ts` (add alongside `trimHistoryProcessor`, etc.)
- Export: Add to `mod.ts`
- Test: `tests/history_processor_test.ts`

**New protocol adapter:**
- Implementation: New directory `lib/{protocol}/adapter.ts` + `types.ts` + `mod.ts`
- Export: Add section to `mod.ts` (follow pattern from A2A/AG-UI sections)
- Test: `tests/{protocol}_test.ts`

**New execution mode or loop variant:**
- Implementation: `lib/execution/{name}.ts`; shared helpers go in `lib/execution/_run_utils.ts`
- Wire into Agent: Add method to `lib/agent.ts`

**New graph feature:**
- Implementation: `lib/graph/{feature}.ts`
- Re-export: `lib/graph/mod.ts` → `mod.ts`
- Test: `tests/graph_{feature}_test.ts`

**New documentation page:**
- Location: `docs/{section}/{page-name}.mdx`
- Register: Add to `docs/docs.json` navigation groups
- Update: `docs_parity.md` status column

## Special Directories

**`.planning/`:**
- Purpose: Planning and analysis documents for this project
- Generated: No (written manually or by planning agents)
- Committed: Yes (source of truth for architecture decisions)

**`docs/`:**
- Purpose: Mintlify documentation source
- Generated: No (authored MDX)
- Committed: Yes
- Dev server: `deno task docs:dev`

**`scripts/`:**
- Purpose: Build automation
- Key file: `build_npm.ts` compiles Deno source for npm publishing

---

*Structure analysis: 2026-03-14*
