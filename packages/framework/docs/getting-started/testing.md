# Testing Your Agent

Vibes is designed to be tested without making real API calls. Tests run in milliseconds, are fully deterministic, and never hit rate limits.

> **Coming from pydantic-ai?** This maps to pydantic-ai's `TestModel` and `FunctionModel`. The pattern is nearly identical: swap the real model for a mock at test time.

## The Core Pattern

Use `agent.override()` to swap the model for a mock in tests:

```ts
import { assertEquals } from "@std/assert";
import { Agent } from "@vibes/framework";
import { TestModel } from "@vibes/framework/testing";
import { anthropic } from "@ai-sdk/anthropic";

// Production agent
const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a helpful assistant.",
});

// In tests, override the model
Deno.test("basic text response", async () => {
  const result = await agent
    .override({ model: new TestModel({ text: "hello from vibes" }) })
    .run("Say hello");

  assertEquals(result.output, "hello from vibes");
});
```

`agent.override()` returns a new agent — the original is unchanged.

## TestModel

`TestModel` is a schema-aware mock that auto-generates valid responses based on the agent's tools and output schema.

```ts
import { TestModel } from "@vibes/framework/testing";

// Returns plain text
const model = new TestModel({ text: "hello world" });

// Auto-calls all tools, then produces final output (default behavior)
const model = new TestModel();
```

**Auto-behavior (default):**
- Turn 1: Calls every non-`final_result` tool once with schema-valid arguments
- Turn 2: Calls `final_result` with schema-valid data (or returns text if no `outputSchema`)

This is useful for smoke-testing that tools execute without errors:

```ts
Deno.test("all tools execute without throwing", async () => {
  const result = await agent
    .override({ model: new TestModel() })
    .run("test");
  assertExists(result.output);
});
```

## MockLanguageModelV3

For fine-grained control, use `MockLanguageModelV3` from `ai/test`:

```ts
import { MockLanguageModelV3, mockValues } from "ai/test";

// Helpers from @vibes/framework/testing
import { textResponse, toolCallResponse } from "@vibes/framework/testing";

Deno.test("tool call followed by text", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: mockValues(
      // Turn 1: model calls the tool
      toolCallResponse("get_weather", { city: "Tokyo" }),
      // Turn 2: model responds with text after seeing tool result
      textResponse("It's 22°C and sunny in Tokyo."),
    ),
  });

  const result = await agent.override({ model }).run("Weather in Tokyo?");
  assertEquals(result.output, "It's 22°C and sunny in Tokyo.");
  assertEquals(result.usage.requests, 2);
});
```

## Testing Structured Output

```ts
Deno.test("structured output", async () => {
  const CountryInfo = z.object({ capital: z.string(), population: z.number() });
  const agent = new Agent({ model: anthropic("..."), outputSchema: CountryInfo });

  const model = new MockLanguageModelV3({
    doGenerate: toolCallResponse("final_result", {
      capital: "Tokyo",
      population: 125.7,
    }),
  });

  const result = await agent.override({ model }).run("Tell me about Japan");
  assertEquals(result.output.capital, "Tokyo");
  assertEquals(result.output.population, 125.7);
});
```

## FunctionModel

`FunctionModel` gives you full control — provide a function that receives the prompt and returns any response:

```ts
import { FunctionModel } from "@vibes/framework/testing";

Deno.test("responds based on message content", async () => {
  const model = new FunctionModel(({ prompt }) => {
    const lastMessage = prompt.findLast((m) => m.role === "user");
    const text = typeof lastMessage?.content === "string"
      ? lastMessage.content
      : "";

    return {
      text: text.includes("hello") ? "Hi there!" : "I don't understand.",
      finishReason: "stop" as const,
      usage: { promptTokens: 5, completionTokens: 3 },
    };
  });

  const agent = new Agent({ model: anthropic("...") });
  const result = await agent.override({ model }).run("hello");
  assertEquals(result.output, "Hi there!");
});
```

## Block Accidental Real API Calls

Use `setAllowModelRequests(false)` at the top of a test file to ensure no real API calls are made:

```ts
import { setAllowModelRequests } from "@vibes/framework";

setAllowModelRequests(false);

// Any agent.run() without a mocked model will now throw ModelRequestsDisabledError
// Safe to use agent.override({ model: mockModel }).run(...) — that still works
```

This is a safety net to prevent accidentally hitting real APIs during tests.

## Inspect What the Model Received

Use `captureRunMessages()` to see exactly what messages were sent to the model:

```ts
import { captureRunMessages } from "@vibes/framework";

Deno.test("dynamic system prompt includes username", async () => {
  const { result, messages } = await captureRunMessages(() =>
    agent.override({ model: mockModel }).run("Hello", {
      deps: { username: "Alice" },
    })
  );

  // messages[turn_index] = messages array sent to the model on that turn
  const systemMessage = messages[0].find((m) => m.role === "system");
  assertEquals(systemMessage?.content?.includes("Alice"), true);
});
```

## Testing Dependencies

Inject test doubles for dependencies (databases, APIs, etc.):

```ts
type Deps = { db: Database };

const agent = new Agent<Deps>({
  model: anthropic("..."),
  tools: [lookupUserTool],
});

Deno.test("looks up user by email", async () => {
  // Use a fake database
  const fakeDb = {
    users: {
      findByEmail: async (email: string) => ({
        id: "u1",
        name: "Alice",
        email,
      }),
    },
  };

  const result = await agent
    .override({ model: mockModel })
    .run("Find alice@example.com", { deps: { db: fakeDb } });

  assertEquals(result.output.includes("Alice"), true);
});
```

## Test File Structure

Recommended test file structure:

```ts
// agents/my_agent_test.ts
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { setAllowModelRequests } from "@vibes/framework";
import { MockLanguageModelV3, mockValues } from "ai/test";
import { textResponse, toolCallResponse } from "@vibes/framework/testing";
import { myAgent } from "./my_agent.ts";

// Block accidental real API calls
setAllowModelRequests(false);

Deno.test("MyAgent - happy path", async () => {
  // ...
});

Deno.test("MyAgent - handles tool errors", async () => {
  // ...
});

Deno.test("MyAgent - validates output schema", async () => {
  // ...
});
```

## Next Steps

- [Testing reference](../testing.md) — full API reference for all test utilities
- [How Agents Work](../concepts/how-agents-work.md) — understand the loop you're testing
- [Result Validators](../result-validators.md) — test retry and validation behavior
