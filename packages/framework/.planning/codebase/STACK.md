# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- TypeScript — all framework source code in `lib/`, tests in `tests/`, scripts in `scripts/`

**Secondary:**
- MDX — documentation pages in `docs/`

## Runtime

**Environment:**
- Deno (primary authoring runtime) — `deno.json` is the project manifest
- Node.js >=18 (npm distribution target) — built via `scripts/build_npm.ts` using `@deno/dnt`

**Package Manager:**
- Deno uses JSR and npm specifiers directly in `deno.json` `imports` map (no lockfile in repo root)
- npm distribution produced to `npm/` directory via the build script

## Frameworks

**Core:**
- Vercel AI SDK (`ai@^6`) — central dependency; provides `LanguageModel`, `generateText`, `streamText`, `ModelMessage`, and `experimental_telemetry`. Every agent execution flows through AI SDK primitives. Used as peer dependency in npm build.
- Zod (`zod@^4`) — schema definition and validation for structured output and tool argument parsing. Used as peer dependency.

**Build/Dev:**
- `jsr:@deno/dnt@^0.41` — Deno-to-npm build tool. Entry: `scripts/build_npm.ts`. Transpiles Deno source to CommonJS/ESM for npm. Produces output in `npm/`.

**Testing:**
- Deno built-in test runner (`deno test -A`) — invoked via `deno task test`
- `ai/test` sub-path (`npm:ai@^6/test`) — AI SDK test utilities (`MockLanguageModelV1`, etc.) used in `lib/testing/`
- `@std/assert` (`jsr:@std/assert@^1.0.19`) — Deno standard assertion library

**Docs:**
- Mintlify — documentation site. Config: `docs/docs.json`. Dev server: `deno task docs:dev`. Build: `deno task docs:build`. All pages in `docs/` as MDX.

## Key Dependencies

**Critical:**
- `ai@^6` (Vercel AI SDK) — `LanguageModel` interface, `generateText`, `streamText`, `Output` for native structured output, `stepCountIs` stop condition, `TelemetrySettings`. All agent execution in `lib/execution/run.ts`, `lib/execution/stream.ts`, `lib/execution/event_stream.ts` calls these.
- `zod@^4` — `ZodType` used in `AgentOptions.outputSchema`, `lib/tool.ts` `fromSchema()`, and all tool argument schemas.
- `@ai-sdk/provider@^3` — AI SDK provider types, used in `lib/types/model_settings.ts` and tool definitions.

**Infrastructure:**
- `@modelcontextprotocol/sdk@^1` — MCP client transport. Three sub-path imports:
  - `@modelcontextprotocol/sdk/client/index.js` — `Client` class in `lib/mcp/mcp_http.ts` and `lib/mcp/mcp_stdio.ts`
  - `@modelcontextprotocol/sdk/client/streamableHttp.js` — `StreamableHTTPClientTransport` in `lib/mcp/mcp_http.ts`
  - `@modelcontextprotocol/sdk/client/stdio.js` — `StdioClientTransport` in `lib/mcp/mcp_stdio.ts`
- `@opentelemetry/api@^1` — `Tracer` type used in `lib/otel/otel_types.ts`; actual span creation delegated to AI SDK's `experimental_telemetry`

**External (peer/optional):**
- `@temporalio/worker` + `@temporalio/workflow` — NOT in `deno.json`; referenced only in JSDoc comments of `lib/temporal/temporal_agent.ts`. Must be installed separately in the consuming Node.js worker process.

## Configuration

**Environment:**
- No `.env` files. MCP config supports `${ENV_VAR}` interpolation via `Deno.env` at runtime (`lib/mcp/mcp_config.ts`).
- `VIBES_SANDBOX_ROOT` — referenced by v2 CLI (`v2/` package), not the framework itself.

**Build:**
- `deno.json` — Deno project manifest, import map, task definitions. Path: `deno.json`
- `scripts/build_npm.ts` — npm package builder. Outputs to `npm/`. Sets `compilerOptions` `ES2022` target, shims Deno globals, declares peer deps (`ai`, `zod`) and direct deps (`@modelcontextprotocol/sdk`, `@opentelemetry/api`).
- `docs/docs.json` — Mintlify docs configuration

## Platform Requirements

**Development:**
- Deno (any recent version with npm specifier support)
- No TypeScript `tsconfig.json` — compiler options specified in `scripts/build_npm.ts` `compilerOptions` block

**Production:**
- npm distribution: Node.js >=18, peer deps `ai@^6` and `zod@^4` required
- Temporal integration requires a separate Node.js worker process with `@temporalio/worker` and `@temporalio/workflow` installed

## Task Commands

```bash
deno task test          # Run all tests with deno test -A
deno task build:npm     # Build npm package to ./npm/
deno task docs:dev      # Start Mintlify dev server (in docs/)
deno task docs:build    # Build Mintlify docs (in docs/)
```

---

*Stack analysis: 2026-03-14*
