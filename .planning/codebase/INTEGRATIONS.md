# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Language Models:**
- Anthropic Claude - Primary model via `@ai-sdk/anthropic` (v3)
  - Default model: `claude-sonnet-4-6` in `packages/vibes/src/constants.ts`
  - SDK: `@ai-sdk/anthropic` v3
  - Usage: `anthropic("claude-sonnet-4-6")` in `packages/vibes/src/agents/core_agent/agent.ts`

- OpenAI GPT - Alternative provider via `@ai-sdk/openai` (v3)
  - SDK: `@ai-sdk/openai` v3
  - Not currently active but available for model selection

**Tool Execution:**
- Model Context Protocol (MCP) - External tool discovery and execution
  - Stdio transport: `packages/framework/lib/mcp/mcp_stdio.ts`
  - HTTP transport: `packages/framework/lib/mcp/mcp_http.ts`
  - Toolset wrapper: `packages/framework/lib/mcp/mcp_toolset.ts`
  - Client: `packages/framework/lib/mcp/mcp_client.ts`

## Data Storage

**Databases:**
- None detected - Application is stateless

**File Storage:**
- Local filesystem only
- Sandbox location: `VIBES_SANDBOX_ROOT` environment variable (default: `/tmp/vibes`)
- Context directory: Passed via `CoreAgentDeps.contextDir` at runtime
- Read-only paths: Context directory + `/data/docs` accessible
- Write-only paths: Sandbox directory only (enforced in `packages/vibes/src/agents/core_agent/toolsets/files.ts`)

**Task/Message Storage:**
- Memory-backed only during agent execution
- No persistence layer detected
- State stored in `CoreAgentDeps` (workflow ID, context directory, run ID)

**Caching:**
- MCP tool list caching: 60-second TTL in `packages/framework/lib/mcp/mcp_toolset.ts`
- No distributed cache detected

## Authentication & Identity

**API Authentication:**
- Anthropic API Key
  - Passed to `@ai-sdk/anthropic` provider
  - Environment variable: Expected in Deno.env (not hardcoded)
  - Required for: `anthropic()` model instantiation

- OpenAI API Key
  - Passed to `@ai-sdk/openai` provider
  - Optional, only if using GPT models

**Application Context:**
- Workflow ID: Per-execution identifier
  - Used for sandbox isolation in `packages/vibes/src/agents/core_agent/toolsets/files.ts`
  - Runtime: Set via `CoreAgentDeps.workflowId`

- Run ID: Per-invocation tracking
  - Passed via `CoreAgentDeps.runId`
  - Used for multi-agent orchestration

## Monitoring & Observability

**Telemetry:**
- OpenTelemetry API (v1) - Distributed tracing infrastructure
  - Span creation: `packages/framework/lib/otel/spans.ts`
  - Attributes recording: `recordUsageAttributes()`, `recordRunAttributes()` in `packages/framework/lib/otel/spans.ts`
  - Integration optional - No active exporter configured

**Error Tracking:**
- None detected - Errors propagated to caller

**Logs:**
- Console output - Agent writes to stdout/stderr during execution
- No structured logging framework detected
- Verbose mode supported in CLI: `--verbose` flag

## CI/CD & Deployment

**Hosting:**
- Self-hosted (Deno runtime required)
- Container-ready (Dockerfile pattern possible)

**CI Pipeline:**
- None detected - Test configuration present but no CI workflow files

**Binary Distribution:**
- Deno compile support: `deno compile --allow-all --output vibes main.ts`
- Produces standalone executable in `packages/vibes/`

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Anthropic API authentication (passed to @ai-sdk/anthropic)
- `VIBES_SANDBOX_ROOT` - Sandbox directory path (optional, defaults to `/tmp/vibes`)

**Optional env vars:**
- `OPENAI_API_KEY` - OpenAI API key (only if using GPT models)
- Standard Deno permissions via `--allow-*` flags

**Secrets location:**
- Environment variables only (Deno.env.get() in `packages/vibes/src/constants.ts`)
- No secrets file detection
- No hardcoded API keys detected

**Feature Flags:**
- Model selection: `claude-sonnet-4-6` hardcoded in `packages/vibes/src/constants.ts`
  - Can be updated for provider switching or model version bumps

## Webhooks & Callbacks

**Incoming:**
- None detected - Application is request-driven via CLI or programmatic Agent API

**Outgoing:**
- MCP Protocol - Bidirectional communication with MCP servers
  - Tool discovery via MCP `list_tools` call in `packages/framework/lib/mcp/mcp_toolset.ts`
  - Tool execution via MCP `call_tool` call in `packages/framework/lib/mcp/mcp_toolset.ts`
  - Server instructions retrieval via `getServerInstructions()` in `packages/framework/lib/mcp/mcp_toolset.ts`

## Multi-Agent Coordination

**Sub-agents:**
- Agent class supports nested agents via `agents` option in `packages/framework/lib/agent.ts`
- No multi-agent orchestration framework detected
- Direct agent composition in application code

**Agent Invocation:**
- Programmatic: `agent.run(prompt, deps)` returns `RunResult<TOutput>`
- Streaming: `agent.stream(prompt, deps)` returns `AsyncIterable<StreamResult<TOutput>>`
- Event streaming: `agent.streamEvents(prompt, deps)` returns `AsyncIterable<AgentStreamEvent>`

---

*Integration audit: 2026-03-14*
