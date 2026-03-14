# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**
- Deno test runner (built-in)
- Config: `deno.json` — task `"test": "deno test -A"` (all permissions)

**Assertion Library:**
- `@std/assert` from JSR: `assertEquals`, `assertExists`, `assertRejects`, `assertThrows`, `assertInstanceOf`

**Run Commands:**
```bash
deno test -A              # Run all tests
deno test -A --watch      # Watch mode
deno test -A <file>       # Run single file
```

## Test File Organization

**Location:**
- All tests in `tests/` directory (sibling to `lib/`)
- Not co-located with source files

**Naming:**
- `{subject}_test.ts` — maps to the feature being tested: `agent_test.ts`, `toolsets_test.ts`, `graph_test.ts`
- Shared helpers in `tests/_helpers.ts` (underscore prefix = internal)

**Structure:**
```
tests/
├── _helpers.ts           # Shared mock factories (textResponse, toolCallResponse, etc.)
├── agent_test.ts         # Core Agent class
├── toolsets_test.ts      # FunctionToolset, CombinedToolset, FilteredToolset, etc.
├── test_model_test.ts    # TestModel mock
├── function_model_test.ts
├── graph_test.ts
├── graph_persistence_test.ts
├── deferred_tools_test.ts
├── override_test.ts
├── stream_test.ts
├── event_stream_test.ts
├── temporal_test.ts
├── mcp_toolset_test.ts
├── otel_test.ts
└── ... (49 test files total)
```

## Test Structure

**Suite Organization:**
```typescript
// No describe() blocks — tests use flat Deno.test() with descriptive names
Deno.test("Agent - basic text run", async () => { ... });
Deno.test("Agent - structured output with Zod schema", async () => { ... });
Deno.test("Agent - tool with deps injection", async () => { ... });
```

Name format: `"ClassName/Feature - scenario description"` e.g.:
- `"Agent - basic text run"`
- `"TestModel - generates valid final_result for string schema"`
- `"FunctionToolset - exposes tools to agent"`
- `"CombinedToolset - last toolset wins on name conflict"`

**No `beforeEach`/`afterEach`** — each test is fully self-contained.

**State isolation pattern:**
```typescript
// Re-enable shared state after each test that modifies it
function withModelRequestsEnabled<T>(fn: () => Promise<T>): Promise<T> {
  setAllowModelRequests(true);
  return fn().finally(() => setAllowModelRequests(true));
}
```

## Mocking

**Framework:** `ai/test` from the Vercel AI SDK provides `MockLanguageModelV3` and `mockValues`.

**Primary mocking pattern — `MockLanguageModelV3` with helper factories:**
```typescript
import { MockLanguageModelV3, mockValues } from "ai/test";
import { textResponse, toolCallResponse } from "./_helpers.ts";

// Single fixed response
const model = new MockLanguageModelV3({
  doGenerate: textResponse("hello world"),
});

// Sequence of responses (each call consumes the next)
const responses = mockValues<DoGenerateResult>(
  toolCallResponse("search", { query: "hello" }),
  textResponse("The answer is 42"),
);
const model = new MockLanguageModelV3({
  doGenerate: () => Promise.resolve(responses()),
});
```

**Helper factories in `tests/_helpers.ts`:**
```typescript
// Returns a text response result
textResponse("hello world"): DoGenerateResult

// Returns a tool call result
toolCallResponse("tool_name", { arg: "value" }, "tc1"): DoGenerateResult

// Returns a streaming text result
textStream("hello world"): DoStreamResult

// Returns a streaming tool call result
toolCallStream("tool_name", { arg: "value" }, "tc1"): DoStreamResult

// Minimal usage object for mock results
makeUsage(): { inputTokens: ..., outputTokens: ... }
```

**Capturing model inputs:**
```typescript
// Inspect what was sent to the model
const model = new MockLanguageModelV3({
  doGenerate: (opts) => {
    capturedNames = opts.tools?.map(t => t.name) ?? [];
    return Promise.resolve(textResponse("done"));
  },
});
```

**`captureRunMessages` utility:**
```typescript
// See exact messages sent to the model per turn
const { result, messages } = await captureRunMessages(() =>
  agent.override({ model: mockModel }).run("Hello", { deps: { username: "Alice" } })
);
// messages[turn_index] = full message array sent on that turn
const systemMessage = messages[0].find((m) => m.role === "system");
```

**`TestModel` — schema-aware auto-responder:**
```typescript
// Defined in lib/testing/test_model.ts, exported from mod.ts
const model = new TestModel();                    // calls all tools then returns text
const model = new TestModel({ text: "hello" });   // returns fixed text
const model = new TestModel({ callTools: false }); // skip tools, go straight to output
const model = createTestModel({ outputSchema: OutputSchema }); // use Zod for valid final_result
```

`TestModel` behavior:
- Turn 1 (`callTools: true`): calls every non-`final_result` tool once with schema-valid args
- Turn 2 (or turn 1 when `callTools: false`): calls `final_result` with schema-valid data, or returns text

**`FunctionModel` — turn-by-turn function control:**
```typescript
// Defined in lib/testing/function_model.ts, exported from mod.ts
const model = new FunctionModel(({ messages, tools, turn }) => {
  // turn is 0-based
  return textResponse("response");
});
```

## What to Mock

**Always mock:**
- The language model via `agent.override({ model: mockModel }).run(...)`
- External dependencies via `deps` injection: `agent.run(prompt, { deps: { db: fakeDb } })`

**Never mock:**
- The `Agent` class itself
- Tool execute functions (test them as real code)
- Internal framework plumbing

**Guard against accidental real API calls:**
```typescript
// Place at top of test file
import { setAllowModelRequests } from "../mod.ts";
setAllowModelRequests(false);
// agent.override({ model: mockModel }) still works
// agent.run() without override throws ModelRequestsDisabledError
```

## Fixtures and Factories

**Inline test data — no separate fixture files:**
```typescript
// Deps are typed inline per test
type Deps = { greeting: string };
const deps = { greeting: "Buenos días!" };

// Schemas defined inline
const OutputSchema = z.object({ name: z.string(), capital: z.string() });
```

**Tool factory helper in tests:**
```typescript
// toolsets_test.ts pattern
function makeTool(name: string) {
  return tool({
    name,
    description: `${name} tool`,
    parameters: z.object({}),
    execute: () => Promise.resolve(`${name} result`),
  });
}
```

**Location:**
- No dedicated `fixtures/` or `__fixtures__/` directory
- All test data defined inline within the test function

## Coverage

**Requirements:** Not enforced — no coverage config detected.

**View Coverage:**
```bash
deno test -A --coverage=cov_profile
deno coverage cov_profile
```

## Test Types

**Unit Tests (dominant pattern):**
- Each test file maps to one module or feature
- Tests are isolated — no shared setup across tests
- Mock all I/O (model calls, deps) via injection

**Integration Tests:**
- Tests that exercise multiple layers together (agent + tool + toolset) in the same test
- `agent_test.ts`, `toolsets_test.ts`, `deferred_tools_test.ts` are integration-style
- No separate integration test directory — mixed with unit tests

**E2E Tests:**
- Not present — all tests use mock models, no real API calls

## Common Patterns

**Async testing:**
```typescript
Deno.test("feature name", async () => {
  const result = await agent.run("prompt");
  assertEquals(result.output, "expected");
});
```

**Error testing:**
```typescript
import { assertRejects } from "@std/assert";

await assertRejects(
  () => agent.run("prompt"),
  MaxTurnsError,  // expected error class
);

// assertThrows for synchronous throws
assertThrows(
  () => someFunction(),
  SomeError,
);
```

**Stateful counter pattern (tool call counting):**
```typescript
let callCount = 0;
const myTool = tool({
  name: "flaky",
  execute: () => {
    callCount++;
    // ...
  },
});
// assert callCount after run
assertEquals(callCount, 2);
```

**Capturing side effects from model calls:**
```typescript
let capturedNames: string[] = [];
const model = new MockLanguageModelV3({
  doGenerate: (opts) => {
    capturedNames = (opts.tools ?? []).map((t: ToolEntry) => t.name);
    return Promise.resolve(textResponse("done"));
  },
});
```

**Streaming tests:**
```typescript
const stream = agent.override({ model: overrideModel }).stream("prompt");
let collected = "";
for await (const chunk of stream.textStream) {
  collected += chunk;
}
assertEquals(collected, "expected text");
```

**Testing with `agent.override()`:**
```typescript
// Override in tests bypasses setAllowModelRequests(false) guard
const result = await agent
  .override({ model: new TestModel({ text: "test response" }) })
  .run("prompt");
```

## Key Test Utilities (Public API)

All exported from `mod.ts` via `lib/testing/mod.ts`:

| Utility | Purpose |
|---------|---------|
| `TestModel` | Schema-aware auto-responding mock |
| `createTestModel(opts)` | Factory for `TestModel` |
| `FunctionModel` | Function-driven mock, full per-turn control |
| `setAllowModelRequests(bool)` | Guard against accidental real API calls |
| `getAllowModelRequests()` | Check current guard state |
| `captureRunMessages(fn)` | Inspect messages sent to model per turn |
| `DoGenerateResult` | Type for mock generate result |
| `ModelFunction` | Type for `FunctionModel` callback |

From `ai/test` (re-exported via `tests/_helpers.ts` for internal test use):
| Utility | Purpose |
|---------|---------|
| `MockLanguageModelV3` | Low-level mock model |
| `mockValues(...items)` | Sequence of responses, consumed in order |
| `convertArrayToReadableStream` | Build stream from array of chunks |

---

*Testing analysis: 2026-03-14*
