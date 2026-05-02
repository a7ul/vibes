# Structured Output

Read this file when the user wants to define structured output with Zod schemas, use result validators, or understand how `outputSchema` and `outputTool` work.

## Basic Structured Output

Use `outputSchema` with a Zod schema to get typed, validated structured output from the agent.

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const WeatherReport = z.object({
  city: z.string(),
  temperature: z.number(),
  conditions: z.enum(["sunny", "cloudy", "rainy", "snowy"]),
  summary: z.string(),
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a weather reporter.",
  outputSchema: WeatherReport,
});

const result = await agent.run("What is the weather in London?");
// result.output is typed as z.infer<typeof WeatherReport>
console.log(result.output.city);         // "London"
console.log(result.output.temperature);  // 15
console.log(result.output.conditions);   // "cloudy"
```

When no `outputSchema` is set, `result.output` is `string`.

## Result Validators

Use `agent.addResultValidator` for validation logic that goes beyond schema validation — business rules, cross-field constraints, or async checks. Throw to reject the output and prompt the model to retry.

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const Report = z.object({
  title: z.string(),
  wordCount: z.number(),
  content: z.string(),
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  outputSchema: Report,
});

// Sync validator
agent.addResultValidator((ctx, result) => {
  const actualWords = result.content.split(/\s+/).length;
  if (Math.abs(actualWords - result.wordCount) > 5) {
    throw new Error(
      `Word count mismatch: reported ${result.wordCount} but content has ${actualWords} words.`,
    );
  }
});

// Async validator
agent.addResultValidator(async (ctx, result) => {
  const isSafe = await checkContentPolicy(result.content);
  if (!isSafe) {
    throw new Error("Content violates policy. Please revise.");
  }
});
```

When a result validator throws, the error message is returned to the model as a retry prompt. `maxRetries` on `AgentOptions` controls how many retry attempts are allowed.

## Output Types Summary

| Pattern | When to use | Result type |
|---|---|---|
| No `outputSchema` | Plain text output | `string` |
| `outputSchema: z.object({...})` | Validated structured output | `z.infer<typeof schema>` |
| `outputSchema: z.union([...])` | One of multiple structured types | Union type |
| `outputTool({ ... })` | Tool-based output, ends run immediately | Tool's return type |

## Output Tools

Use `outputTool` when the model calling the tool should immediately end the run. The tool's return value becomes `result.output`.

```typescript
import { Agent, outputTool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const submitAnswer = outputTool({
  name: "submit_answer",
  description: "Submit the final answer to end the task.",
  parameters: z.object({
    answer: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  execute: async (ctx, { answer, confidence }) => ({
    answer,
    confidence,
    timestamp: new Date().toISOString(),
  }),
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "Answer the user's question and submit your final answer.",
  tools: [researchTool, submitAnswer], // model calls submitAnswer to end the run
});
```

## Union Output Types

Use `z.union([...])` or `z.discriminatedUnion(...)` for outputs that can take multiple forms:

```typescript
const SuccessOutput = z.object({ success: z.literal(true), data: z.string() });
const ErrorOutput = z.object({ success: z.literal(false), reason: z.string() });
const Output = z.discriminatedUnion("success", [SuccessOutput, ErrorOutput]);

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  outputSchema: Output,
});

const result = await agent.run("...");
if (result.output.success) {
  console.log(result.output.data);
} else {
  console.log(result.output.reason);
}
```

## Testing Structured Output

Use `createTestModel({ outputSchema })` to auto-generate schema-valid test output:

```typescript
import { createTestModel, setAllowModelRequests } from "@vibesjs/sdk";

setAllowModelRequests(false);

const OutputSchema = z.object({ answer: z.string(), score: z.number() });
const model = createTestModel({ outputSchema: OutputSchema });

const result = await agent.override({ model }).run("Test");
// result.output.answer === "test response"
// result.output.score === 0 (zero is schema-valid for z.number())
```
