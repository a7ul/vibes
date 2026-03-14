# Tools

Tools give the model the ability to call functions during a run. Each tool has a name, a description the model uses to decide when to call it, a Zod parameter schema, and an execute function.

## Defining a Tool

Use the `tool()` factory for full type inference:

```ts
import { tool } from "./mod.ts";
import { z } from "zod";

const search = tool({
  name: "search",
  description: "Search the web for up-to-date information",
  parameters: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async (_ctx, { query }) => {
    const results = await fetchSearchResults(query);
    return results;
  },
});
```

## `ToolDefinition<TDeps>`

| Field         | Type                                       | Description                                                                                                  |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `name`        | `string`                                   | Unique identifier. The model uses this to call the tool.                                                     |
| `description` | `string`                                   | Natural language description. This is what the model reads to decide when to use the tool. Write it clearly. |
| `parameters`  | `ZodTypeAny`                               | Zod schema for the arguments. Validated before `execute` is called.                                          |
| `execute`     | `(ctx, args) => Promise<string \| object>` | The function to run. Receives a [`RunContext`](./run-context.md) and the parsed args.                        |
| `maxRetries`  | `number`                                   | Optional. How many times to retry `execute` if it throws. See [Retrying Tools](#retrying-tools).             |

## Type Parameters

```ts
tool<TDeps, TParams>({ ... })
```

- **`TDeps`** — type of `ctx.deps` inside `execute`. Must match the agent's `TDeps`.
- **`TParams`** — inferred from `parameters`. `args` in `execute` is typed as `z.infer<TParams>`.

```ts
type Deps = { db: Database };

const getUser = tool<Deps>({
  name: "get_user",
  description: "Fetch a user from the database",
  parameters: z.object({ id: z.string() }),
  execute: async (ctx, { id }) => {
    return await ctx.deps.db.users.findById(id);
  },
});
```

## Registering Tools

Pass tools to the agent at construction time or via `addTool`:

```ts
// At construction
const agent = new Agent({ model: ..., tools: [search, getUser] });

// After construction
agent.addTool(anotherTool);
```

## Accessing Context in Tools

The first argument to `execute` is a [`RunContext`](./run-context.md):

```ts
execute: async (ctx, args) => {
  console.log(ctx.deps); // your injected dependencies
  console.log(ctx.usage); // token usage so far
  console.log(ctx.toolName); // "my_tool" — the current tool's name
  console.log(ctx.runId); // unique ID for this run
  return "done";
};
```

## Tool Return Values

Return a `string` or any JSON-serialisable `object`. The value is serialised and appended to the message history as a tool result, which the model sees on the next turn.

```ts
// String — simplest case
execute: async (_ctx, { city }) => `${city}: 22°C`,

// Object — structured data
execute: async (_ctx, { id }) => ({ id, name: "Alice", role: "admin" }),
```

## Retrying Tools

Set `maxRetries` on a tool to automatically retry its `execute` function if it throws. The final error is re-thrown after all attempts are exhausted.

```ts
const flakyApi = tool({
  name: "flaky_api",
  description: "Calls an unreliable external API",
  parameters: z.object({ endpoint: z.string() }),
  maxRetries: 2, // will try up to 3 times total (1 + 2 retries)
  execute: async (_ctx, { endpoint }) => {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
});
```

> Tool retries are transparent to the model — it only sees the final result or error.

## Parameter Descriptions

Add `.describe()` to Zod fields to give the model more context about each argument:

```ts
parameters: z.object({
  city: z.string().describe("The city name, e.g. 'Tokyo' or 'New York'"),
  units: z.enum(["celsius", "fahrenheit"]).describe("Temperature unit").default("celsius"),
}),
```

## Multiple Tools

Agents can have any number of tools. On each turn the model decides which (if any) to call:

```ts
const agent = new Agent({
  model: ...,
  tools: [search, calculator, getUser, sendEmail],
});
```

## Tools Without Dependencies

If your agent has no dependencies (`TDeps = undefined`), the first argument is still present but `ctx.deps` is `undefined`:

```ts
const echo = tool({
  name: "echo",
  description: "Echo back the input",
  parameters: z.object({ message: z.string() }),
  execute: async (_ctx, { message }) => message,
});
```
