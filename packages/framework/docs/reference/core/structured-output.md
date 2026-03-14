---
title: "Structured Output"
description: "Zod-validated typed responses via outputSchema"
---

# Structured Output

By default an agent returns a plain `string`. Provide an `outputSchema` to get a
fully typed, Zod-validated object back instead.

## Basic Usage

```ts
import { Agent } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const CityInfo = z.object({
  name: z.string(),
  capital: z.string(),
  population: z.number(),
});

const agent = new Agent<undefined, z.infer<typeof CityInfo>>({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a geography assistant.",
  outputSchema: CityInfo,
});

const result = await agent.run("Tell me about France.");
console.log(result.output.capital); // "Paris"
console.log(result.output.population); // 67_000_000
```

`result.output` is typed as `z.infer<typeof CityInfo>` — no casting needed.

## How It Works

When `outputSchema` is set, the framework injects a synthetic tool called
`final_result` into every run. The model is expected to call this tool with its
answer rather than replying with plain text.

If the model responds with text instead of calling `final_result`, it receives a
nudge message and tries again (up to `maxRetries` times). This matches how
pydantic-ai enforces structured output.

## Nested and Complex Schemas

Any Zod schema works — nested objects, arrays, unions, discriminated unions:

```ts
const AnalysisResult = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(0).max(1),
  topics: z.array(z.string()),
  summary: z.string(),
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["person", "place", "organisation"]),
    }),
  ),
});
```

## Type Parameter

The second type parameter `TOutput` on `Agent<TDeps, TOutput>` is inferred when
you provide `outputSchema`:

```ts
// Explicit — preferred for clarity
const agent = new Agent<undefined, z.infer<typeof MySchema>>({ ... });

// TypeScript infers TOutput = z.infer<typeof MySchema>
// but you still need to set it explicitly for result.output to be typed
```

## Combining with Tools

Structured output and tools can be used together. The model calls tools to
gather data, then uses `final_result` to return the structured answer:

```ts
const agent = new Agent<Deps, Report>({
  model: ...,
  outputSchema: ReportSchema,
  tools: [fetchData, querySql],
  systemPrompt: "Gather data using the provided tools, then return a structured report.",
});
```

## Validation Errors

If the model calls `final_result` with arguments that fail Zod validation, the
error is sent back to the model with a message asking it to correct the data.
This counts against `maxRetries`.

```ts
const agent = new Agent({
  model: ...,
  outputSchema: z.object({ score: z.number().int().min(1).max(10) }),
  maxRetries: 5, // allow more retries for complex schemas
});
```

If all retries are exhausted, [`MaxRetriesError`](../core/errors) is thrown.

## Union Output Types

Use Zod discriminated unions to let the model return one of several shapes:

```ts
const Result = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), text: z.string() }),
  z.object({ type: z.literal("clarification"), question: z.string() }),
]);

const agent = new Agent<undefined, z.infer<typeof Result>>({
  model,
  outputSchema: Result,
});

const result = await agent.run("What is 2 + 2?");
if (result.output.type === "answer") {
  console.log(result.output.text);
}
```

## `outputMode`

Controls how the framework asks the model to produce structured output:

| Mode               | Behaviour                                                                   | When to use                   |
| ------------------ | --------------------------------------------------------------------------- | ----------------------------- |
| `"tool"` (default) | Injects a `final_result` tool; model calls it                               | Most models; best type safety |
| `"native"`         | Uses the model's native structured-output API (e.g. `responseFormat`)       | Models with native JSON mode  |
| `"prompted"`       | Appends a JSON instruction to the system prompt; parses the last code block | Models without tool support   |

```ts
const agent = new Agent({
  model,
  outputSchema: MySchema,
  outputMode: "native",
});
```

## `outputTemplate`

When `outputMode` is `"prompted"`, customise the JSON instruction appended to
the system prompt:

```ts
const agent = new Agent({
  model,
  outputSchema: MySchema,
  outputMode: "prompted",
  outputTemplate:
    "Respond ONLY with a JSON object matching this schema:\n{schema}",
});
```

The `{schema}` placeholder is replaced with the JSON Schema derived from your
Zod schema.

## Streaming with Structured Output

Structured output works with `.stream()` too. Text deltas stream as the model
works through its reasoning. The final `output` promise resolves with the
validated object:

```ts
const stream = agent.stream("Analyse this document.");

// Stream intermediate text (model's reasoning)
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

// Get the final validated object
const result = await stream.output;
console.log(result.sentiment);
```
