---
title: "Tools"
description: "tool(), plainTool(), outputTool(), fromSchema() factories"
---

# Tools

Tools give the model the ability to call functions during a run. Each tool has a
name, a description the model uses to decide when to call it, a Zod parameter
schema, and an execute function.

## Defining a Tool

Use the `tool()` factory for full type inference:

```ts
import { tool } from "@vibes/framework";
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
| `execute`     | `(ctx, args) => Promise<string \| object>` | The function to run. Receives a [`RunContext`](../core/run-context) and the parsed args.                        |
| `maxRetries`  | `number`                                   | Optional. How many times to retry `execute` if it throws. See [Retrying Tools](#retrying-tools).             |

## Type Parameters

```ts
tool<TDeps, TParams>({ ... })
```

- **`TDeps`** — type of `ctx.deps` inside `execute`. Must match the agent's
  `TDeps`.
- **`TParams`** — inferred from `parameters`. `args` in `execute` is typed as
  `z.infer<TParams>`.

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

The first argument to `execute` is a [`RunContext`](../core/run-context):

```ts
execute: (async (ctx, args) => {
  console.log(ctx.deps); // your injected dependencies
  console.log(ctx.usage); // token usage so far
  console.log(ctx.toolName); // "my_tool" — the current tool's name
  console.log(ctx.runId); // unique ID for this run
  return "done";
});
```

## Tool Return Values

Return a `string` or any JSON-serialisable `object`. The value is serialised and
appended to the message history as a tool result, which the model sees on the
next turn.

```ts
// String — simplest case
execute: async (_ctx, { city }) => `${city}: 22°C`,

// Object — structured data
execute: async (_ctx, { id }) => ({ id, name: "Alice", role: "admin" }),
```

## Retrying Tools

Set `maxRetries` on a tool to automatically retry its `execute` function if it
throws. The final error is re-thrown after all attempts are exhausted.

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

> Tool retries are transparent to the model — it only sees the final result or
> error.

## Parameter Descriptions

Add `.describe()` to Zod fields to give the model more context about each
argument:

```ts
parameters: z.object({
  city: z.string().describe("The city name, e.g. 'Tokyo' or 'New York'"),
  units: z.enum(["celsius", "fahrenheit"]).describe("Temperature unit").default("celsius"),
}),
```

## Multiple Tools

Agents can have any number of tools. On each turn the model decides which (if
any) to call:

```ts
const agent = new Agent({
  model: ...,
  tools: [search, calculator, getUser, sendEmail],
});
```

## Tools Without Dependencies

If your agent has no dependencies (`TDeps = undefined`), the first argument is
still present but `ctx.deps` is `undefined`:

```ts
const echo = tool({
  name: "echo",
  description: "Echo back the input",
  parameters: z.object({ message: z.string() }),
  execute: async (_ctx, { message }) => message,
});
```

## `plainTool` — Skipping the Context

When a tool needs no dependency injection at all, use `plainTool` for a cleaner
signature without the unused `ctx` parameter:

```ts
import { plainTool } from "@vibes/framework";

const add = plainTool({
  name: "add",
  description: "Add two numbers",
  parameters: z.object({ a: z.number(), b: z.number() }),
  execute: async ({ a, b }) => String(a + b),
});
```

## `fromSchema` — Raw JSON Schema

When integrating with external schema registries or OpenAPI specs, build a tool
directly from a raw JSON Schema object instead of Zod:

```ts
import { fromSchema } from "@vibes/framework";

const search = fromSchema({
  name: "search",
  description: "Search documents",
  jsonSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  execute: async (_ctx, args) => doSearch(args.query as string),
});
```

## `outputTool` — Terminal Tools

An output tool ends the run immediately when the model calls it. Its return
value becomes `result.output`. This is the manual equivalent of `outputSchema`.

```ts
import { outputTool } from "@vibes/framework";

const done = outputTool({
  name: "done",
  description: "Return the final structured answer",
  parameters: z.object({ answer: z.string(), confidence: z.number() }),
  execute: async (_ctx, args) => args,
});

const agent = new Agent({ model, tools: [done] });
const result = await agent.run("What is 2 + 2?");
// result.output = { answer: "4", confidence: 0.99 }
```

## `sequential` Flag

By default, when the model calls multiple tools in a single turn they execute
concurrently. Set `sequential: true` to force a tool to acquire a run-level
mutex — useful for tools that must not overlap with each other:

```ts
const writeFile = tool({
  name: "write_file",
  description: "Write content to a file",
  parameters: z.object({ path: z.string(), content: z.string() }),
  sequential: true, // only one write at a time
  execute: async (_ctx, { path, content }) => {
    await Deno.writeTextFile(path, content);
    return "written";
  },
});
```

## `requiresApproval` Flag

Mark a tool as requiring human approval before execution. The run pauses and
throws `ApprovalRequiredError`. See [Deferred Tools](../advanced/deferred-tools).

```ts
const deleteRecord = tool({
  name: "delete_record",
  description: "Permanently delete a database record",
  parameters: z.object({ id: z.string() }),
  requiresApproval: true,
  execute: async (_ctx, { id }) => db.delete(id),
});
```

Pass a function for conditional approval:

```ts
requiresApproval: (_ctx, args) => args.id.startsWith("prod_"),
```

## `argsValidator` — Cross-Field Validation

Zod validates each field in isolation. Use `argsValidator` for cross-field
constraints that Zod alone cannot express. Throwing from `argsValidator`
surfaces an error without consuming a retry:

```ts
const bookFlight = tool({
  name: "book_flight",
  description: "Book a flight",
  parameters: z.object({
    departDate: z.string(),
    returnDate: z.string(),
  }),
  argsValidator: ({ departDate, returnDate }) => {
    if (new Date(returnDate) <= new Date(departDate)) {
      throw new Error("Return date must be after depart date");
    }
  },
  execute: async (_ctx, args) => doBook(args),
});
```

## `prepare` — Per-Turn Tool Modification

Called once per turn before tools are sent to the model. Return a modified tool
definition to change its description or parameters dynamically, or return
`null`/`undefined` to hide the tool on this turn:

```ts
const contextualSearch = tool({
  name: "search",
  description: "Search",
  parameters: z.object({ query: z.string() }),
  prepare: (ctx) => {
    if (!ctx.deps.searchEnabled) return null; // hide tool
    return {
      name: "search",
      description: `Search within ${ctx.deps.scope}`,
      parameters: z.object({ query: z.string() }),
      execute: contextualSearch.execute,
    };
  },
  execute: async (_ctx, { query }) => doSearch(query),
});
```
