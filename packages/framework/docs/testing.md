# Testing

The Vercel AI SDK ships a `ai/test` module with mock model implementations that
let you unit test agents without making real API calls. Tests run in
milliseconds and are fully deterministic.

## Setup

Add `ai/test` to your import map:

```jsonc
// deno.json
{
  "imports": {
    "ai/test": "npm:ai@^4/test"
  }
}
```

Run tests with `--allow-env` (the SDK reads the `DEBUG` env var at module load):

```bash
deno test --allow-env src/packages/framework/tests/
```

## Mock Utilities

```ts
import {
  convertArrayToReadableStream, // build streams for doStream
  MockLanguageModelV1, // drop-in model replacement
  mockValues, // cycle through multiple responses
} from "ai/test";
```

### `MockLanguageModelV1`

A `LanguageModelV1` implementation you control. Pass `doGenerate` for `.run()`
tests, `doStream` for `.stream()` tests.

```ts
const model = new MockLanguageModelV1({
  doGenerate: () =>
    Promise.resolve({
      text: "hello world",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
});
```

### `mockValues(...values)`

Returns a function that cycles through the provided values one at a time. Use it
when a test needs multiple different responses across turns:

```ts
const doGenerate = mockValues(
  firstResponse, // returned on first call
  secondResponse, // returned on second call
);

const model = new MockLanguageModelV1({
  doGenerate: () => Promise.resolve(doGenerate()),
});
```

### `convertArrayToReadableStream(chunks)`

Builds a `ReadableStream` from an array of stream part chunks. Used with
`doStream`:

```ts
const model = new MockLanguageModelV1({
  doStream: () =>
    Promise.resolve({
      stream: convertArrayToReadableStream([
        { type: "text-delta", textDelta: "hello" },
        {
          type: "finish",
          finishReason: "stop",
          usage: { promptTokens: 10, completionTokens: 5 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
});
```

## Helper Types

Use `Awaited<ReturnType<...>>` to type mock response objects correctly:

```ts
type DoGenerateResult = Awaited<ReturnType<MockLanguageModelV1["doGenerate"]>>;
type DoStreamResult = Awaited<ReturnType<MockLanguageModelV1["doStream"]>>;
```

This avoids type errors when using `mockValues` with mixed response shapes.

## Testing Recipes

### Plain Text Response

```ts
Deno.test("basic text run", async () => {
  const model = new MockLanguageModelV1({
    doGenerate: () =>
      Promise.resolve({
        text: "hello world",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
  });

  const agent = new Agent({ model });
  const result = await agent.run("Say hello.");

  assertEquals(result.output, "hello world");
  assertEquals(result.usage.requests, 1);
});
```

### Structured Output

Simulate the model calling `final_result` with your structured data:

```ts
Deno.test("structured output", async () => {
  const OutputSchema = z.object({ capital: z.string() });

  const model = new MockLanguageModelV1({
    doGenerate: () =>
      Promise.resolve({
        toolCalls: [
          {
            toolCallType: "function",
            toolCallId: "tc1",
            toolName: "final_result",
            args: JSON.stringify({ capital: "Paris" }),
          },
        ],
        finishReason: "tool-calls",
        usage: { promptTokens: 10, completionTokens: 5 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });

  const result = await agent.run("Capital of France?");
  assertEquals(result.output.capital, "Paris");
});
```

### Multi-Turn (Tool Call then Text)

```ts
Deno.test("tool call then text", async () => {
  type DoGenerateResult = Awaited<
    ReturnType<MockLanguageModelV1["doGenerate"]>
  >;

  const doGenerate = mockValues<DoGenerateResult>(
    // Turn 1: model calls the tool
    {
      toolCalls: [
        {
          toolCallType: "function",
          toolCallId: "tc1",
          toolName: "get_weather",
          args: JSON.stringify({ city: "Tokyo" }),
        },
      ],
      finishReason: "tool-calls",
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    },
    // Turn 2: model produces final text after seeing tool result
    {
      text: "The weather in Tokyo is 22°C and sunny.",
      finishReason: "stop",
      usage: { promptTokens: 20, completionTokens: 10 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    },
  );

  const weatherTool = tool({
    name: "get_weather",
    description: "Get weather",
    parameters: z.object({ city: z.string() }),
    execute: async (_ctx, { city }) => `${city}: 22°C, sunny`,
  });

  const model = new MockLanguageModelV1({
    doGenerate: () => Promise.resolve(doGenerate()),
  });

  const agent = new Agent({ model, tools: [weatherTool] });
  const result = await agent.run("Weather in Tokyo?");

  assertEquals(result.output.includes("22°C"), true);
  assertEquals(result.usage.requests, 2);
});
```

### Result Validator Retry

```ts
Deno.test("validator rejects then retries", async () => {
  type Output = { score: number };
  type DoGenerateResult = Awaited<
    ReturnType<MockLanguageModelV1["doGenerate"]>
  >;

  const doGenerate = mockValues<DoGenerateResult>(
    // First attempt: invalid score
    {
      toolCalls: [
        {
          toolCallType: "function",
          toolCallId: "tc1",
          toolName: "final_result",
          args: JSON.stringify({ score: 0 }),
        },
      ],
      finishReason: "tool-calls",
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    },
    // Second attempt: valid score
    {
      toolCalls: [
        {
          toolCallType: "function",
          toolCallId: "tc2",
          toolName: "final_result",
          args: JSON.stringify({ score: 7 }),
        },
      ],
      finishReason: "tool-calls",
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    },
  );

  const model = new MockLanguageModelV1({
    doGenerate: () => Promise.resolve(doGenerate()),
  });
  const agent = new Agent<undefined, Output>({
    model,
    outputSchema: z.object({ score: z.number() }),
    resultValidators: [
      (_ctx, output) => {
        if (output.score < 1) throw new Error("Too low");
        return output;
      },
    ],
  });

  const result = await agent.run("Score?");
  assertEquals(result.output.score, 7);
  assertEquals(result.retryCount, 1);
});
```

### Streaming

```ts
Deno.test("stream text", async () => {
  const model = new MockLanguageModelV1({
    doStream: () =>
      Promise.resolve({
        stream: convertArrayToReadableStream([
          { type: "text-delta", textDelta: "hello " },
          { type: "text-delta", textDelta: "world" },
          {
            type: "finish",
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 5 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
  });

  const agent = new Agent({ model });
  const stream = agent.stream("Say hello.");

  let collected = "";
  for await (const chunk of stream.textStream) {
    collected += chunk;
  }

  assertEquals(collected, "hello world");
  assertEquals(await stream.output, "hello world");
});
```

### `setAllowModelRequests` — Guard Against Accidental API Calls

Call this at the top of a test file to ensure any non-mocked agent run throws
immediately instead of making a real API call:

```ts
import { setAllowModelRequests } from "@vibes/framework";

setAllowModelRequests(false); // throws ModelRequestsDisabledError for real calls

// Use agent.override({ model: mockModel }) for the runs you do want to execute
```

### `captureRunMessages` — Inspect Messages Sent to the Model

Wrap any agent call to record the exact messages sent to the model on each turn:

```ts
import { captureRunMessages } from "@vibes/framework";

const { result, messages } = await captureRunMessages(() =>
  agent.run("Hello", { deps: myDeps })
);

// messages[0] = messages array for turn 1
// messages[1] = messages array for turn 2
assertEquals(messages[0].some((m) => m.role === "system"), true);
```

### `TestModel` — Schema-Aware Mock

`TestModel` is a higher-level mock that understands the agent's tool schema. It
lets you specify tool call sequences without manually constructing raw SDK
response objects:

```ts
import { TestModel } from "@vibes/framework";
import { z } from "zod";

const OutputSchema = z.object({ answer: z.string() });

const model = new TestModel({
  responses: [
    // Turn 1: call a tool
    { toolCalls: [{ name: "search", args: { query: "vibes framework" } }] },
    // Turn 2: produce structured output
    { output: { answer: "Vibes is a TypeScript agent framework." } },
  ],
});

const agent = new Agent({
  model,
  outputSchema: OutputSchema,
  tools: [searchTool],
});
const result = await agent.run("What is vibes?");
assertEquals(result.output.answer.includes("Vibes"), true);
```

### `FunctionModel` — Programmatic Control

`FunctionModel` gives you full control by accepting a function that receives the
current prompt and returns a response. Useful for testing behaviour that depends
on message content:

```ts
import { FunctionModel } from "@vibes/framework";

const model = new FunctionModel(({ prompt }) => {
  const lastUser = prompt.findLast((m) => m.role === "user");
  const content = typeof lastUser?.content === "string" ? lastUser.content : "";
  return {
    text: content.includes("hello") ? "Hi there!" : "I don't understand.",
    finishReason: "stop" as const,
    usage: { promptTokens: 5, completionTokens: 3 },
  };
});

const agent = new Agent({ model });
const result = await agent.run("hello");
assertEquals(result.output, "Hi there!");
```

### Inspecting What the Model Received

```ts
Deno.test("dynamic system prompt is included", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV1({
    doGenerate: (opts) => {
      capturedSystem = opts.prompt.find((m) => m.role === "system")
        ?.content as string;
      return Promise.resolve({
        text: "ok",
        finishReason: "stop",
        usage: { promptTokens: 5, completionTokens: 2 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      });
    },
  });

  const agent = new Agent<{ username: string }>({
    model,
    dynamicSystemPrompt: (ctx) => `Hello, ${ctx.deps.username}`,
  });

  await agent.run("Hi", { deps: { username: "Alice" } });
  assertEquals(capturedSystem?.includes("Alice"), true);
});
```
