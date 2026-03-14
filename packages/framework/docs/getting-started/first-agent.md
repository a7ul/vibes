---
title: "Your First Agent"
description: "Create and run your first agent in minutes"
---

This guide walks you through creating a basic agent, running it, and understanding what happens at each step.

> **Coming from pydantic-ai?** The `Agent` class maps directly to pydantic-ai's `Agent`. `agent.run()` is equivalent to `agent.run_sync()`. The `RunResult` is equivalent to pydantic-ai's `RunResult`.

## Create an Agent

```ts
import { Agent } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful assistant. Be concise.",
});
```

An `Agent` holds configuration - model, system prompt, tools, output schema. It has no mutable state; you can reuse it across many runs.

## Run It

```ts
const result = await agent.run("What is the capital of France?");

console.log(result.output);
// "Paris"
```

`.run()` blocks until the agent produces a final answer and returns a `RunResult`.

## Read the Result

```ts
console.log(result.output);      // "Paris" (the text response)
console.log(result.usage);       // { promptTokens, completionTokens, totalTokens, requests }
console.log(result.messages);    // full message history (user + assistant turns)
console.log(result.runId);       // unique ID for this run (useful for logging)
```

## What Happens Internally

When you call `agent.run()`:

1. **System prompt** is resolved (static string or function)
2. **Messages** are built: `[system, user]` for a fresh run
3. **Model is called** with the messages and available tools
4. **Response is processed:**
   - If the model returns text → that's the output, run ends
   - If the model calls tools → tools are executed, results appended, loop repeats
5. **Result validators** run on the output (if any)
6. **`RunResult`** is returned

This loop is called the _agent loop_. The model drives it - Vibes just handles the plumbing.

See [How Agents Work](../concepts/how-agents-work.md) for a deeper dive.

## Dynamic System Prompts

System prompts can be functions. This is useful when the prompt needs runtime context:

```ts
import { Agent } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";

type Deps = { username: string; locale: string };

const agent = new Agent<Deps>({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: (ctx) =>
    `You are a helpful assistant for ${ctx.deps.username}. Respond in ${ctx.deps.locale}.`,
});

const result = await agent.run("What time is it?", {
  deps: { username: "Alice", locale: "French" },
});
```

The function receives a [`RunContext`](../reference/core/run-context) with `deps`, `usage`, `runId`, and `metadata`.

## Multiple System Prompts

Pass an array to combine prompts:

```ts
const agent = new Agent({
  model,
  systemPrompt: "You are a helpful assistant.",
  instructions: (ctx) => `Today is ${new Date().toDateString()}.`,
});
```

`systemPrompt` and `instructions` are both appended to the system turn. Use `systemPrompt` for stable, static configuration and `instructions` for dynamic, per-run context.

## Agent Type Parameters

```ts
class Agent<TDeps = undefined, TOutput = string>
```

- **`TDeps`** - the type of `deps` passed at run time. Defaults to `undefined` (no deps needed).
- **`TOutput`** - the type of `result.output`. Defaults to `string`. Override by providing an `outputSchema`.

```ts
// No deps, string output (defaults)
const agent = new Agent({ model });

// Custom deps, string output
const agent = new Agent<{ db: Database }>({ model });

// Custom deps, structured output
const agent = new Agent<{ db: Database }, { answer: string }>({
  model,
  outputSchema: z.object({ answer: z.string() }),
});
```

## Next Steps

- [Adding Tools](./adding-tools.md) - give the agent real capabilities
- [Structured Output](./structured-output.md) - get typed JSON responses
- [Testing Your Agent](./testing.md) - test without API calls
