# Testing and Debugging

Read this file when the user wants to test agent behavior, use `TestModel`, use `FunctionModel`, capture messages, or prevent real API calls.

## Preventing Accidental API Calls

Call `setAllowModelRequests(false)` once at the top of every test file to raise a clear error if any agent accidentally reaches a real model API:

```typescript
import { setAllowModelRequests } from "@vibesjs/sdk";

// At the top of your test file
setAllowModelRequests(false);
```

`agent.override({ model })` with a test model bypasses this guard automatically — test models always work.

## TestModel — Automatic Simulation

`TestModel` auto-generates schema-valid tool calls and a final response on every run. Use it when you want fast, deterministic tests that verify the agent's logic without writing out exact model responses.

```typescript
import { Agent, setAllowModelRequests, TestModel, createTestModel } from "@vibesjs/sdk";
import { z } from "zod";

setAllowModelRequests(false);

const agent = new Agent({
  model: openai("gpt-4o"),
  systemPrompt: "Be helpful.",
  tools: [myTool],
});

// Basic: returns "test response" as output
const model = new TestModel();
const result = await agent.override({ model }).run("Hello");
console.log(result.output); // "test response"

// With output schema: generates schema-valid structured output
const OutputSchema = z.object({ answer: z.string(), score: z.number() });
const typedModel = createTestModel({ outputSchema: OutputSchema });
const typedResult = await agent.override({ model: typedModel }).run("Hello");
console.log(typedResult.output.answer); // "test response"
console.log(typedResult.output.score);  // 0 (default number)
```

`TestModel` options:

| Option | Type | Default | Description |
|---|---|---|---|
| `callTools` | `boolean` | `true` | Auto-call all agent tools on the first turn |
| `text` | `string` | `"test response"` | Text returned when there is no output schema |
| `outputSchema` | Zod schema | — | When provided, auto-generates schema-valid structured output |

`createTestModel({ outputSchema })` is a shorthand for `new TestModel({ outputSchema })`.

## FunctionModel — Per-Turn Control

Use `FunctionModel` when you need precise control over what the model returns on each turn. Its constructor takes a function that receives `{ messages, tools, turn }` and must return a `DoGenerateResult`.

```typescript
import { FunctionModel } from "@vibesjs/sdk";

const model = new FunctionModel(({ messages, tools, turn }) => {
  if (turn === 0) {
    // First turn: call a tool
    return {
      content: [
        {
          type: "tool-call",
          toolCallId: "tc-1",
          toolName: "search",
          input: JSON.stringify({ query: "hello world" }),
        },
      ],
      finishReason: { unified: "tool-calls", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0 },
        outputTokens: { total: 5 },
      },
      warnings: [],
    };
  }
  // Second turn: return the final answer
  return {
    content: [{ type: "text", text: "The search results are: ..." }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: { total: 20, noCache: 20, cacheRead: 0 },
      outputTokens: { total: 10 },
    },
    warnings: [],
  };
});

const result = await agent.override({ model }).run("Search for hello world");
```

`FunctionModel` is best when you need to:
- Assert on what messages/tools the agent sent to the model
- Test multi-turn conversations with specific sequences of tool calls
- Simulate specific model behaviors (e.g. model returning invalid args)

## captureRunMessages — Inspect Model Messages

`captureRunMessages` wraps an agent run and captures the `ModelMessage[]` arrays that were passed to the model on each turn:

```typescript
import { captureRunMessages, TestModel } from "@vibesjs/sdk";

const model = new TestModel();
const [messages] = await captureRunMessages(
  () => agent.override({ model }).run("Hello"),
);

// messages[0] = messages sent on turn 0
// messages[1] = messages sent on turn 1 (if any)
console.log(messages[0]);
```

`captureRunMessages` is **not concurrency-safe** — run tests that use it sequentially, not in parallel.

## agent.override() — Swap Components in Tests

Use `agent.override({ model, tools, toolsets, deps, ... })` to inject test doubles without modifying the agent definition:

```typescript
const { run } = agent.override({
  model: new TestModel(),
  // Can also override:
  // tools: [...],
  // toolsets: [...],
  // systemPrompt: "...",
  // outputSchema: z.object({...}),
});

const result = await run("Hello");
```

`agent.override()` returns `{ run, stream, runStreamEvents }` — **not** an `Agent` instance.

## Testing Structured Output

```typescript
import { createTestModel, setAllowModelRequests } from "@vibesjs/sdk";
import { z } from "zod";

setAllowModelRequests(false);

const OutputSchema = z.object({
  city: z.string(),
  country: z.string(),
});

const agent = new Agent({
  model: openai("gpt-4o"),
  outputSchema: OutputSchema,
});

const model = createTestModel({ outputSchema: OutputSchema });
const result = await agent.override({ model }).run("Where is Paris?");

// TestModel generates schema-valid output automatically
console.log(result.output.city);    // "test response"
console.log(result.output.country); // "test response"
```

## Testing Tools

```typescript
import { FunctionModel, setAllowModelRequests } from "@vibesjs/sdk";

setAllowModelRequests(false);

// Verify the agent calls the expected tool
const model = new FunctionModel(({ tools, turn }) => {
  if (turn === 0) {
    // Assert that the tool we expect is present
    const toolNames = tools.map((t) => t.name);
    assert(toolNames.includes("search"), "search tool should be present");

    return {
      content: [{ type: "tool-call", toolCallId: "tc1", toolName: "search", input: '{"query":"test"}' }],
      finishReason: { unified: "tool-calls", raw: undefined },
      usage: { inputTokens: { total: 5, noCache: 5, cacheRead: 0 }, outputTokens: { total: 5 } },
      warnings: [],
    };
  }
  return {
    content: [{ type: "text", text: "Done" }],
    finishReason: { unified: "stop", raw: undefined },
    usage: { inputTokens: { total: 5, noCache: 5, cacheRead: 0 }, outputTokens: { total: 5 } },
    warnings: [],
  };
});

const result = await agent.override({ model }).run("Search for test");
```

## Deno Test Runner

Tests in Vibes use Deno's test runner:

```typescript
import { assertEquals } from "@std/assert";
import { Agent, TestModel, setAllowModelRequests } from "@vibesjs/sdk";

setAllowModelRequests(false);

Deno.test("agent returns expected output", async () => {
  const model = new TestModel();
  const result = await agent.override({ model }).run("Hello");
  assertEquals(result.output, "test response");
});
```

Run tests with:
```bash
deno test -A
```
