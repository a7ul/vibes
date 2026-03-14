# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- TypeScript 5+ - All source code in `packages/framework/lib/` and `packages/vibes/src/`

**Secondary:**
- JSX/TSX - UI components in `packages/vibes/src/surface/tui/components/`

## Runtime

**Environment:**
- Deno 2.x - Primary runtime for all TypeScript execution

**Package Manager:**
- Deno native package manager with npm interoperability
- Lockfile: Not detected (npm imports resolved via import map)

## Frameworks

**Core Framework:**
- Vercel AI SDK (`ai` v6) - Language model abstraction layer at `packages/framework/lib/`
- Built-in support for streaming, tool execution, structured output

**Agent Framework:**
- Custom @vibes/framework - Wraps Vercel AI SDK with agentic patterns
  - Location: `packages/framework/`
  - Exports: Agent class, tool builders, toolsets, streaming utilities
  - Primary export: `packages/framework/mod.ts`

**UI/Terminal:**
- React 18 - Component-based UI abstraction
- Ink 5 - React renderer for terminal output in `packages/vibes/src/surface/tui/`
- Ink Spinner 5 - Loading indicators
- Ink Text Input 6 - Interactive terminal input

**Model Context Protocol:**
- @modelcontextprotocol/sdk v1 - MCP client and transport layer
  - Stdio transport: `packages/framework/lib/mcp/mcp_stdio.ts`
  - HTTP transport: `packages/framework/lib/mcp/mcp_http.ts`

**Testing:**
- ai/test (v6) - Mock language models from Vercel AI SDK
- Deno test runner (native) - No external test framework
- Config: `deno.json` tasks: `"test": "deno test --allow-env --allow-net"`

**Observability:**
- @opentelemetry/api v1 - Telemetry and tracing infrastructure
- Span recording and attribute management in `packages/framework/lib/otel/`

**Build/Dev:**
- Deno compile - Binary compilation support
- Deno watch - File watching for development

## Key Dependencies

**Critical:**
- `ai` (v6) - Vercel AI SDK for language model interactions, streaming, tool calling
- `zod` (v4) - Schema validation for tool parameters and structured output
- `@ai-sdk/anthropic` (v3) - Anthropic Claude model provider
- `@ai-sdk/openai` (v3) - OpenAI GPT model provider

**Infrastructure:**
- `@modelcontextprotocol/sdk` (v1) - MCP protocol implementation for connecting external tools
- `@anthropic-ai/sandbox-runtime` - Sandboxed execution environment
- `@opentelemetry/api` (v1) - Distributed tracing infrastructure
- `@ai-sdk/provider` (v3.0.0-0) - Type definitions for model providers

**Standard Library:**
- `@std/assert` (v1.0.19) - Testing assertions (JSR)
- `@std/path` (v1) - Path utilities (JSR)
- `@std/cli` (v1) - CLI argument parsing (JSR)

## Configuration

**Environment:**
- Runtime configuration via `Deno.env.get()` in `packages/vibes/src/constants.ts`:
  - `VIBES_SANDBOX_ROOT` - Sandbox directory (defaults to `/tmp/vibes`)
  - Model selection: Hardcoded to `claude-sonnet-4-6` in `packages/vibes/src/constants.ts`

**Compiler Options:**
- JSX: "react-jsx" with importSource "npm:react@^18" (deno.json)

**Import Map:**
- Workspace packages via relative imports: `@vibes/framework` → `../framework/mod.ts`
- npm packages via `npm:` prefix in deno.json imports

**Workspace:**
- Monorepo structure in root `deno.json`:
  - `./packages/framework` - Core agent framework
  - `./packages/vibes` - CLI application

## Platform Requirements

**Development:**
- Deno 2.x installed
- TypeScript support (bundled with Deno)
- Unix-like shell for sandbox operations

**Production:**
- Deno runtime
- Anthropic API key for Claude models (via `@ai-sdk/anthropic`)
- OpenAI API key optional for GPT models (via `@ai-sdk/openai`)
- 200+ MB for sandbox file operations

## Build & Execution

**Tasks (deno.json):**
```bash
deno task dev           # Watch mode for development
deno task test          # Run all tests with environment and network access
deno compile           # Binary compilation (packages/vibes/)
```

**CLI Entry Point:**
- `packages/vibes/main.ts` - Command-line interface
- TUI entry point: `packages/vibes/tui.ts` - Terminal user interface

---

*Stack analysis: 2026-03-14*
