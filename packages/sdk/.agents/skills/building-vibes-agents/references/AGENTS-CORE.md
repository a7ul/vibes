# Agents Core

Read this file when the user needs the core `Agent` workflow: creating agents, choosing output types, using dependencies, selecting models, or choosing how to run/stream an agent.

## Create a Basic Agent

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  systemPrompt: "Be concise, reply with one sentence.",
});

const result = await agent.run("What is the capital of France?");
console.log(result.output); // "Paris."
```

## Structured Output with Zod Schemas

Use `outputSchema` when the model should return validated structured data.

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const CityLocation = z.object({
  city: z.string(),
  country: z.string(),
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  outputSchema: CityLocation,
});

const result = await agent.run("Where were the Olympics held in 2012?");
console.log(result.output.city);    // "London"
console.log(result.output.country); // "United Kingdom"
```

When choosing output mode:

- No `outputSchema` → `result.output` is `string` (plain text)
- `outputSchema: z.object({...})` → typed structured output, validated by Zod
- Result validators → use `agent.addResultValidator(fn)` for additional validation after schema parsing

## Dependency Injection

Use `deps` at run time when tools or the system prompt need app state (databases, API clients, config, user context).

```typescript
import { Agent, tool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

type Deps = { currentUser: { name: string; role: string } };

const getUserRole = tool<Deps>({
  name: "get_user_role",
  description: "Get the current user's role.",
  parameters: z.object({}),
  execute: async (ctx) => ctx.deps.currentUser.role,
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: (ctx) => `The user's name is ${ctx.deps.currentUser.name}.`,
  tools: [getUserRole],
});

const result = await agent.run("What is my role?", {
  deps: { currentUser: { name: "Alice", role: "admin" } },
});
```

Dynamic system prompts receive a `RunContext<Deps>` and can be sync or async. Static system prompts are plain strings.

## Choose or Configure Models

Any model from the Vercel AI SDK works. Pass model instances directly:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

// Anthropic
const agent1 = new Agent({ model: anthropic("claude-sonnet-4-6"), ... });

// OpenAI
const agent2 = new Agent({ model: openai("gpt-4o"), ... });

// Google
const agent3 = new Agent({ model: google("gemini-2.5-flash"), ... });
```

Use `modelSettings` on `AgentOptions` or `RunOptions` for per-model settings (temperature, maxTokens, etc.):

```typescript
const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  modelSettings: { temperature: 0.2, maxTokens: 1000 },
});

// Or override at run time:
const result = await agent.run("Hello", {
  modelSettings: { temperature: 0.8 },
});
```

## Run Methods

| Method | Returns | When to use |
|---|---|---|
| `agent.run(prompt, opts?)` | `Promise<RunResult<TOutput>>` | Await the complete result |
| `agent.stream(prompt, opts?)` | `AsyncIterable<string>` | Streaming text output |
| `agent.runStreamEvents(prompt, opts?)` | `AsyncIterable<AgentStreamEvent>` | Typed event stream for progress tracking |

```typescript
// (1) Await the complete result
const result = await agent.run("Tell me a joke");
console.log(result.output);

// (2) Stream text
for await (const chunk of agent.stream("Tell me a story")) {
  process.stdout.write(chunk);
}

// (3) Process the typed event stream
for await (const event of agent.runStreamEvents("Do the task")) {
  if (event.kind === "text-delta") {
    process.stdout.write(event.delta);
  }
  if (event.kind === "tool-call") {
    console.log(`Calling ${event.toolName}...`);
  }
}
```

## Message History and Multi-Turn Conversations

Pass `messageHistory` to continue a conversation:

```typescript
const result1 = await agent.run("My name is Alice.");
const result2 = await agent.run("What is my name?", {
  messageHistory: result1.messages,
});
console.log(result2.output); // "Your name is Alice."
```

Use `result.messages` to get all messages in the run (including the new user message, model responses, tool calls, and tool results).
Use `result.newMessages` to get only the messages added in this run.

## Max Turns, Max Retries, and Usage Limits

```typescript
const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "Be helpful.",
  maxTurns: 5,       // stop after 5 model turns
  maxRetries: 3,     // retry result validators up to 3 times
});

// Or set per-run:
const result = await agent.run("Do the task", {
  usageLimits: { maxTokens: 10000 },
});
```

## Result Access

```typescript
const result = await agent.run("...");

result.output      // TOutput — the final validated output
result.usage       // { inputTokens, outputTokens, totalTokens, requests }
result.messages    // ModelMessage[] — full conversation history
result.newMessages // ModelMessage[] — only messages from this run
```
