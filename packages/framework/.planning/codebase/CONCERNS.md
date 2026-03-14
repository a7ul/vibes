# Codebase Concerns

**Analysis Date:** 2026-03-14

---

## API Bugs in Docs (Code-Doc Mismatch)

### Graph Constructor: Object vs Array Signature

- Issue: `docs/reference/integrations/graph.mdx` shows the constructor as `new Graph({ nodes: [...] })` (object with a `nodes` key). The actual signature in `lib/graph/graph.ts` is `new Graph(nodes[], options?)` — nodes are passed as the first positional array argument, options as an optional second argument.
- Files: `docs/reference/integrations/graph.mdx` lines 55–65, `lib/graph/graph.ts` line 150–157
- Impact: Every reader copying the documented example will get a TypeScript compile error. The object `{ nodes: [...] }` is not assignable to `BaseNode[]`.
- Fix approach: Change the doc example from `new Graph({ nodes: [...] })` to `new Graph([new FetchNode(), new SummariseNode()])`. The options table shows `{ maxIterations? }` which IS correct as a second arg.

### BaseNode `this.next()` / `this.output()`: Instance Methods vs Module Functions

- Issue: `docs/reference/integrations/graph.mdx` shows node code calling `this.next(nodeId, state)` and `this.output(value)` as if they are inherited instance methods of `BaseNode`. The actual public API exports `next()` and `output()` as standalone module-level functions from `lib/graph/types.ts`. `BaseNode` in `lib/graph/node.ts` has NO `next` or `output` methods.
- Files: `docs/reference/integrations/graph.mdx` lines 32–43, `lib/graph/node.ts`, `lib/graph/types.ts`, `lib/graph/mod.ts`
- Impact: Any developer following the docs will get "Property 'next' does not exist on type 'FetchNode'" at compile time. The real API requires importing `next` and `output` as named exports alongside `BaseNode`.
- Fix approach: Update all doc examples to import and call `next("summarise", { ...state, results })` and `output(summary.output)` directly. Update the API reference table in the doc — remove `this.next()` and `this.output()` rows from the BaseNode member table and explain that `next` and `output` are imported module functions.

### AG-UI `depsFactory` Option Does Not Exist

- Issue: `docs/reference/integrations/ag-ui.mdx` lines 113–118 shows a recipe using `depsFactory: (req) => ({...})` in `AGUIAdapterOptions`. This option does not exist. The actual `AGUIAdapterOptions` interface in `lib/ag_ui/adapter.ts` lines 97–105 only accepts `deps` (static, already-resolved deps) and `getState` (a callback for state snapshots). There is no per-request factory.
- Files: `docs/reference/integrations/ag-ui.mdx`, `lib/ag_ui/adapter.ts` lines 97–105
- Impact: Anyone trying to inject per-request deps (e.g., extract user ID from `req.headers`) has no documented or implemented path. The recipe in the docs silently doesn't work.
- Fix approach: Either (a) implement `depsFactory: (req: Request) => TDeps` on `AGUIAdapterOptions` in the adapter, or (b) rewrite the recipe to use `Deno.serve` with a manual wrapper that extracts deps before calling `adapter.handleRequest(input)`.

### AG-UI `handleRequest` Takes `AGUIRunInput`, Not `Request`

- Issue: `docs/reference/integrations/ag-ui.mdx` lines 36 and 136 show `adapter.handleRequest(req)` where `req` is a raw `Request` object from `Deno.serve`. The actual signature is `handleRequest(input: AGUIRunInput): Response` — it takes a pre-parsed `AGUIRunInput` object, not a raw HTTP `Request`.
- Files: `docs/reference/integrations/ag-ui.mdx`, `lib/ag_ui/adapter.ts` line 139
- Impact: The basic usage example and the CORS recipe both call the API incorrectly. The correct method for raw request handling is `adapter.handler()`, which returns a `(req: Request) => Promise<Response>` function that parses the body internally.
- Fix approach: Replace `adapter.handleRequest(req)` with `adapter.handler()(req)` in the basic usage and CORS examples, or restructure the "Basic Usage" section around `Deno.serve(adapter.handler())`.

---

## Broken Links in README

- Issue: All 29 documentation links in `README.md` use `.md` extensions and flat paths (e.g., `./docs/agents.md`, `./docs/getting-started/install.md`). The actual files use `.mdx` extensions and are organized under a different hierarchy (e.g., `docs/reference/core/agents.mdx`, `docs/getting-started/install.mdx`). Every single link in the README is broken.
- Files: `README.md` lines 86–111
- Impact: Any developer clicking any documentation link from the GitHub README lands on a 404. This is the first impression for new users. Broken on GitHub, Mintlify hosting resolves URLs differently.
- Count: 29 broken links across Getting Started, Concepts, Guides, and Reference sections.
- Fix approach: Update all README links to use `.mdx` extension and correct paths matching the actual `docs/` hierarchy, or remove the deep-link section and replace with a single link to the hosted docs URL.

---

## Missing Documentation Pages (from `docs_parity.md`)

The following areas have zero documentation pages. See `docs_parity.md` for the full gap analysis.

### A2A (Agent-to-Agent) — Zero Docs

- Issue: The A2A adapter is fully implemented in `lib/a2a/` (adapter, task store, types — ~900 lines) but there is no documentation page anywhere. `docs_parity.md` flags this as one of the 8 biggest gaps.
- Files: `lib/a2a/adapter.ts`, `lib/a2a/task_store.ts`, `lib/a2a/types.ts`, `lib/a2a/mod.ts`
- Impact: Users cannot discover or use agent-to-agent communication. The `AgentCard`, JSON-RPC endpoint, task lifecycle, streaming subscription, and `tasks/cancel` flows are completely undocumented.
- Priority: P2 — create `docs/reference/integrations/a2a.mdx`

### Models & Providers — Zero Per-Provider Pages

- Issue: There are no per-provider pages for Anthropic, OpenAI, Google (Gemini), Groq, Mistral, Ollama, or OpenAI-compatible models. No models overview page exists either.
- Impact: Every new user's first question — "how do I use Claude / GPT-4 / Gemini?" — is unanswered in the docs.
- Priority: P1 — create `docs/concepts/models.mdx` covering all providers

### Evals — No Section

- Issue: No evaluation framework documentation exists. `docs_parity.md` identifies this as a ~12-page gap.
- Impact: Production credibility gap. LLM evals are expected for serious frameworks.
- Note: This likely requires framework-level feature work before docs can be written. Tracked as future milestone.

### Examples — No Runnable Examples

- Issue: No standalone runnable examples exist. pydantic-ai has 17. Getting-started pages have snippets but no complete copy-paste programs.
- Priority: P3

### Missing Guide Pages (README links to non-existent files)

- `docs/guides/multi-turn-conversations.mdx` — does not exist (README links to `./docs/guides/multi-turn-conversations.md`)
- `docs/guides/streaming-responses.mdx` — does not exist (README links to `./docs/guides/streaming-responses.md`)
- `docs/guides/mcp-servers.mdx` — does not exist (README links to `./docs/guides/mcp-servers.md`)

### Missing Reference Pages (README links to non-existent files)

All of these flat reference files linked from README do not exist:
- `docs/agents.md` → actual file is `docs/reference/core/agents.mdx`
- `docs/tools.md` → actual file is `docs/reference/core/tools.mdx`
- `docs/toolsets.md` → actual file is `docs/reference/core/toolsets.mdx`
- `docs/structured-output.md` → actual file is `docs/reference/core/structured-output.mdx`
- `docs/streaming.md` → actual file is `docs/reference/core/streaming.mdx`
- `docs/dependencies.md` → actual file is `docs/reference/core/dependencies.mdx`
- `docs/testing.md` → actual file is `docs/reference/core/testing.mdx`
- `docs/message-history.md` → actual file is `docs/reference/advanced/message-history.mdx`
- `docs/deferred-tools.md` → actual file is `docs/reference/advanced/deferred-tools.mdx`
- `docs/graph.md` → actual file is `docs/reference/integrations/graph.mdx`
- `docs/mcp.md` → actual file is `docs/reference/integrations/mcp.mdx`
- `docs/ag-ui.md` → actual file is `docs/reference/integrations/ag-ui.mdx`
- `docs/otel.md` → actual file is `docs/reference/integrations/otel.mdx`
- `docs/temporal.md` → actual file is `docs/reference/integrations/temporal.mdx`
- `docs/index.md` — does not exist at all
- `docs/features.md` — does not exist (actual: `docs/reference/features.mdx`)

---

## Partial / Wrong Docs (from `docs_parity.md`)

The following pages exist but contain incorrect, incomplete, or misleading content beyond the API bugs listed above.

### `docs/reference/integrations/graph.mdx`

- Constructor, `this.next()`, `this.output()` all wrong (detailed above).
- Missing: Graph steps deep-dive, joins/reducers, parallel execution.
- The Mermaid example output shows `stateDiagram-v2` but `lib/graph/mermaid.ts` generates `flowchart TD` (confirmed by test `graph_test.ts` line 137).

### `docs/reference/integrations/ag-ui.mdx`

- `handleRequest` signature wrong, `depsFactory` doesn't exist (detailed above).
- Missing: SSE event sequence diagram, `handler()` method not shown as the primary integration path.

### `docs/reference/core/streaming.mdx`

- Missing: `runStreamEvents` example, event stream diagram.

### `docs/reference/advanced/deferred-tools.mdx`

- Missing: `agent.resume()` flow sequence diagram.

### `docs/reference/integrations/mcp.mdx`

- Covers both client and server on one page, but MCP server exposure is not actually documented.

### `docs/reference/advanced/message-history.mdx`

- Missing: serialization examples, history processor coverage.

### `docs/reference/core/tools.mdx`

- Missing: `prepare`, `argsValidator`, `requiresApproval`, `sequential` details.

### `docs/getting-started/testing.mdx` and `docs/reference/core/testing.mdx`

- Split across 2 pages with no `captureRunMessages` examples.

---

## Fragile Areas

### `lib/execution/_run_utils.ts` — Over File Size Limit

- Files: `lib/execution/_run_utils.ts` (832 lines)
- Why fragile: At 832 lines this file exceeds the 800-line guideline. It concentrates core agent loop logic. Changes here risk regressions across streaming, deferred tools, structured output, and tool calling paths simultaneously.
- Safe modification: Make changes only with full test suite passing. No test coverage for internal utility functions directly — they are exercised indirectly via `agent_test.ts`, `stream_test.ts`, `deferred_tools_test.ts`.
- Test coverage: Indirect only, no unit tests for `_run_utils.ts` internals directly.

### `lib/ag_ui/adapter.ts` — `handleRequest` Accepts Pre-Parsed Input

- Files: `lib/ag_ui/adapter.ts`
- Why fragile: `handleRequest(input: AGUIRunInput)` accepts pre-parsed typed input, but the docs and the object docstring example both show it being called with a raw `Request`. The `handler()` method does the parsing. This asymmetry means anyone integrating without reading the source will write a broken integration.
- Safe modification: Either align the API (have `handleRequest` accept `Request`) or fix all documentation examples.

### `lib/a2a/adapter.ts` — Default URL Hardcoded

- Files: `lib/a2a/adapter.ts` line 176
- Issue: `url: options.url ?? "http://localhost:8000"` — the `AgentCard` gets a localhost URL by default if the caller doesn't pass `url`. An agent deployed to production will advertise a localhost address in its agent card to any discovering client.
- Risk: Discovery-based A2A clients will attempt to contact `localhost:8000` instead of the real deployment URL.
- Fix approach: Remove the default fallback or replace with `undefined`/empty string and document that `url` is required for production deployments.

### `lib/graph/graph.ts` — `graph.run()` Throws Generic Error on Unexpected State

- Files: `lib/graph/graph.ts` line 195
- Issue: `throw new Error("Graph ended without producing output.")` — if `GraphRun.next()` returns `null` or a non-output step after the while loop, a generic `Error` (not a typed graph error) is thrown. This can't be caught with a specific error type.
- Fix approach: Define and throw a typed `GraphEndedWithoutOutputError` consistent with `MaxGraphIterationsError` and `UnknownNodeError`.

---

## Tech Debt

### Docs Directory Structure Mismatches Package README

- Issue: The `README.md` was written assuming a flat `docs/` structure with `.md` files. The actual Mintlify docs site uses `.mdx` files in a nested hierarchy (`docs/reference/core/`, `docs/reference/advanced/`, `docs/reference/integrations/`). The README was never updated after the docs were reorganized.
- Files: `README.md`, all files under `docs/`
- Impact: 29 broken links on GitHub (see Broken Links section above).

### Docs JSON Navigation (`docs/docs.json`) May Not Match Actual File List

- Files: `docs/docs.json`
- The navigation config drives the Mintlify sidebar. If it references pages that don't exist yet (planned pages) or pages that have moved, the docs site will show broken sidebar entries. This should be audited when new pages are added.

### No Changelog or Version Policy

- Files: None exist
- `docs_parity.md` flags `changelog.mdx` and version policy as missing project-level pages. For a 0.1.0 package, this is expected, but as the framework evolves breaking changes cannot be communicated to users.

### `@vibes/framework` Version Pinned at `0.1.0`

- Files: `deno.json`
- The package is at `0.1.0`. The README installation example says `jsr:@vibes/framework@^0.1`. If breaking API changes are made before `1.0.0`, the semver range `^0.1` will NOT protect users (semver major-zero ranges allow breaking changes). No changelog exists to communicate breaks.

---

## Test Coverage Gaps

### No Tests for A2A Streaming / Cancellation Paths

- What's not tested: The SSE streaming path in `lib/a2a/adapter.ts` (`handleTaskSendSubscribe`) and the cancellation signal (`AbortController` integration) are not covered in `tests/a2a_test.ts`.
- Files: `lib/a2a/adapter.ts` lines 293–474, `tests/a2a_test.ts`
- Risk: Streaming task updates and task cancellation could silently break.
- Priority: High

### No Tests for AG-UI `handler()` Method

- What's not tested: The `handler()` method that wraps JSON parsing around `handleRequest`. Tests in `tests/ag_ui_test.ts` likely test `handleRequest` directly with pre-built `AGUIRunInput`, not the full HTTP path via `handler()`.
- Files: `lib/ag_ui/adapter.ts` lines 312–334, `tests/ag_ui_test.ts`
- Risk: Input validation errors and malformed request body handling could regress.
- Priority: Medium

### `lib/execution/_run_utils.ts` Not Directly Unit-Tested

- What's not tested: Internal helper functions in the 832-line `_run_utils.ts` are tested only indirectly via agent integration tests.
- Files: `lib/execution/_run_utils.ts`
- Risk: Subtle logic bugs in tool call handling, turn limits, or output schema construction are harder to isolate.
- Priority: Medium

---

## Documentation Gaps Summary (from `docs_parity.md`)

| Status | Count |
|--------|-------|
| Complete | 2 |
| Partial/wrong/thin | 31 |
| Missing entirely | 47 |

**Total tracked against pydantic-ai: ~80 items**

Top 8 gaps by impact (from `docs_parity.md`):
1. Models/providers — zero per-provider pages
2. A2A — zero docs for a fully-implemented feature
3. MCP Server — only client side documented
4. Examples — zero standalone runnable examples
5. Thinking/extended reasoning — no docs for Anthropic/Google budget tokens
6. Vercel AI UI streaming — no `useChat`/`useCompletion` integration docs
7. Durable execution overview — Temporal page exists but no overview
8. Evals — 12-page section gap, requires framework feature work first

Full priority order for addressing gaps is in `docs_parity.md` lines 233–292.

---

*Concerns audit: 2026-03-14*
