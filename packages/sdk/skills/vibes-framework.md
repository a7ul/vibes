---
name: vibes-framework
description: Expert assistant for building AI agents with @vibesjs/sdk. Fetches live docs before generating code so the API reference is always current.
---

You are an expert in `@vibesjs/sdk`. Before writing any framework code, **always fetch the latest documentation** — never rely on training data or memory for the API.

## Step 1: Fetch docs before writing code

### Preferred: Context7 (most up-to-date)

If the `mcp__context7__resolve-library-id` tool is available:

```
1. Call mcp__context7__resolve-library-id with libraryName "@vibesjs/sdk"
2. Call mcp__context7__get-library-docs with the returned library ID
3. Use the returned docs to write accurate code
```

### Fallback: WebFetch from source

If Context7 is not available, fetch from the repo directly. Start with the index, then fetch the specific doc for what you need:

| Topic | URL |
|-------|-----|
| Full index | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/index.md` |
| Agents | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/agents.md` |
| Tools | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/tools.md` |
| Toolsets | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/toolsets.md` |
| Structured Output | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/structured-output.md` |
| Streaming | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/streaming.md` |
| Testing | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/testing.md` |
| Dependencies | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/dependencies.md` |
| Message History | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/message-history.md` |
| Deferred Tools | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/deferred-tools.md` |
| Graph | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/graph.md` |
| MCP | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/mcp.md` |
| AG-UI | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/ag-ui.md` |
| OpenTelemetry | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/otel.md` |
| Temporal | `https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/docs/temporal.md` |

## Step 2: Installation

All imports come from a single entry point: `@vibesjs/sdk`

`deno.json`:
```jsonc
{
  "imports": {
    "@vibesjs/sdk": "jsr:@vibesjs/sdk@^0.1",
    "ai": "npm:ai@^6",
    "zod": "npm:zod@^4",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@^1"
  }
}
```

## Step 3: Critical gotchas (static — these are easy to get wrong)

These are the non-obvious mistakes that will cause silent failures or type errors. Keep these in mind regardless of what the docs say:

- **Stream events use `.kind`, not `.type`** — always `event.kind === "text-delta"`, never `event.type`
- **`next()` and `output()` in graph nodes are free functions** — import them from `@vibesjs/sdk` and call them directly; they are NOT methods on the node (`this.next()` does not exist)
- **`TOutput` is inferred from `outputSchema`** — never specify it explicitly as a type parameter (`new Agent<Deps, MyType>()` is wrong)
- **`agent.override()` returns `{ run, stream, runStreamEvents }`** — it does NOT return an `Agent` instance
- **`deps` goes at run time, not construction time** — `agent.run(prompt, { deps: myDeps })`, not the constructor
- **`setAllowModelRequests(false)` must be called in tests** — otherwise tests will make real API calls
- **`captureRunMessages` is not concurrency-safe** — run test cases using it sequentially
