---
title: "Adding Tools"
description: "Give your agent capabilities with type-safe tools"
---

# Adding Tools

Tools give agents the ability to take actions — search the web, call APIs, read files, query databases, or run any code you write.

> **Coming from pydantic-ai?** Vibes tools map directly to pydantic-ai's `@agent.tool` decorator pattern, but as plain objects using the `tool()` factory. Parameters use Zod instead of Pydantic.

## Define a Tool

```ts
import { tool } from "@vibes/framework";
import { z } from "zod";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({
    city: z.string().describe("The city name, e.g. 'Tokyo'"),
  }),
  execute: async (_ctx, { city }) => {
    // In a real app, call a weather API here
    return `${city}: 22°C, sunny`;
  },
});
```

A tool has four parts:
- **`name`** — how the model refers to the tool (snake_case recommended)
- **`description`** — tells the model what the tool does and when to use it. Write it for the model, not for humans.
- **`parameters`** — a Zod schema. The model must provide values matching this schema.
- **`execute`** — your implementation. Receives `RunContext` and the validated args.

## Register on an Agent

```ts
import { Agent, tool } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const getWeather = tool({ /* ... */ });

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful weather assistant.",
  tools: [getWeather],
});

const result = await agent.run("What's the weather in Tokyo and London?");
console.log(result.output);
// "Tokyo is 22°C and sunny. London is 15°C and cloudy."
```

## What Happens During Execution

When the model decides to call `get_weather`:

1. Vibes validates the model's arguments against your Zod schema
2. Your `execute` function is called with `(ctx, validatedArgs)`
3. The return value is sent back to the model as the tool result
4. The model sees the result and continues (may call more tools or produce a final answer)
5. This loop repeats until the model stops calling tools

If the model calls multiple tools in one turn, they run **concurrently** by default.

## Using RunContext in Tools

The first argument to `execute` is a [`RunContext`](../reference/core/run-context). It carries:
- `ctx.deps` — your injected dependencies (database, config, etc.)
- `ctx.usage` — token usage so far
- `ctx.runId` — the unique ID for this run

```ts
type Deps = { db: Database };

const lookupUser = tool({
  name: "lookup_user",
  description: "Look up a user by email address",
  parameters: z.object({ email: z.string().email() }),
  execute: async (ctx, { email }) => {
    // ctx.deps is typed as Deps
    const user = await ctx.deps.db.users.findByEmail(email);
    if (!user) return "User not found";
    return { id: user.id, name: user.name };
  },
});

const agent = new Agent<Deps>({
  model: anthropic("claude-haiku-4-5-20251001"),
  tools: [lookupUser],
});

const result = await agent.run("Find the user alice@example.com", {
  deps: { db: myDatabase },
});
```

## Multiple Tools

Agents can have as many tools as the model supports:

```ts
const agent = new Agent({
  model,
  tools: [searchWeb, readFile, writeFile, queryDatabase, sendEmail],
});
```

The model decides which tools to call, when, and with what arguments.

## Tool Retries

If a tool throws, you can configure automatic retries:

```ts
const flakeyTool = tool({
  name: "flakey_api",
  description: "Calls an unreliable external API",
  parameters: z.object({ id: z.string() }),
  maxRetries: 3,  // retry up to 3 times on error
  execute: async (_ctx, { id }) => {
    const response = await fetch(`https://api.example.com/items/${id}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  },
});
```

## Cross-Field Validation

Use `argsValidator` to validate relationships between fields that Zod schemas can't express:

```ts
const bookFlight = tool({
  name: "book_flight",
  description: "Book a flight",
  parameters: z.object({
    departure: z.string(),
    arrival: z.string(),
    date: z.string(),
  }),
  argsValidator: ({ departure, arrival }) => {
    if (departure === arrival) {
      throw new Error("Departure and arrival cities must be different");
    }
  },
  execute: async (_ctx, args) => {
    // argsValidator ran first — safe to proceed
    return await flightApi.book(args);
  },
});
```

Throwing in `argsValidator` does NOT consume a retry — the error is sent back to the model as feedback to fix its arguments.

## Sequential Tools

By default, all tools in a turn run concurrently. Mark a tool as `sequential` to ensure it acquires a per-run mutex:

```ts
const writeToSharedState = tool({
  name: "update_record",
  sequential: true,   // only one runs at a time
  // ...
});
```

## Next Steps

- [Toolsets](../reference/core/toolsets) — composable, context-aware tool groups
- [Structured Output](./structured-output.md) — get typed JSON from the agent
- [Dependencies](../concepts/dependency-injection.md) — injecting databases, APIs, and config
