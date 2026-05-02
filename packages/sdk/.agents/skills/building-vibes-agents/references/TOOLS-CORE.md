# Tools Core

Read this file when the user wants to add function tools, choose between `tool` and `plainTool`, use `argsValidator`, or add tools to toolsets.

## Add Tools to an Agent

Use `plainTool` for pure functions and `tool<Deps>` for tools that need `RunContext`.

```typescript
import { Agent, plainTool, tool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// plainTool — receives only the validated args, no context
const rollDice = plainTool({
  name: "roll_dice",
  description: "Roll a six-sided die and return the result.",
  parameters: z.object({}),
  execute: async () => String(Math.floor(Math.random() * 6) + 1),
});

// tool — receives RunContext as first argument
type Deps = { playerName: string };

const getPlayerName = tool<Deps>({
  name: "get_player_name",
  description: "Get the current player's name.",
  parameters: z.object({}),
  execute: async (ctx) => ctx.deps.playerName,
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  systemPrompt: "You are a dice game host. Greet the player by name after rolling.",
  tools: [rollDice, getPlayerName],
});
```

## Choosing Between `tool` and `plainTool`

Default choices:

- `plainTool` when the tool is a pure function with no dependency injection, usage tracking, or context needed
- `tool<Deps>` when the tool needs `ctx.deps`, `ctx.usage`, `ctx.messages`, `ctx.retry`, or `ctx.toolCallId`

```typescript
// Use RunContext fields:
// ctx.deps         — injected dependencies
// ctx.usage        — current token usage
// ctx.messages     — full message history
// ctx.retry        — current retry count for this tool
// ctx.toolCallId   — unique ID for this tool call invocation
```

## Tool Parameters with Zod

Use Zod schemas for all tool parameters. The schema is used both for JSON Schema generation (sent to the model) and for runtime argument validation.

```typescript
const searchTool = plainTool({
  name: "search",
  description: "Search the knowledge base.",
  parameters: z.object({
    query: z.string().describe("The search query"),
    maxResults: z.number().int().min(1).max(20).optional().describe("Max results to return"),
    filter: z.enum(["recent", "popular", "all"]).optional(),
  }),
  execute: async ({ query, maxResults = 5, filter = "all" }) => {
    return doSearch(query, { maxResults, filter });
  },
});
```

Use `.describe(...)` on fields to add descriptions sent to the model.

## Tool Retries with `maxRetries`

Set `maxRetries` on a tool to automatically retry on any thrown error:

```typescript
const flakeyTool = tool({
  name: "flakey_api",
  description: "Calls an occasionally flaky API.",
  parameters: z.object({ id: z.string() }),
  maxRetries: 2,
  execute: async (ctx, { id }) => {
    const response = await fetch(`https://api.example.com/items/${id}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },
});
```

When a tool throws and `maxRetries > 0`, Vibes retries up to `maxRetries` times before propagating the error to the model as a retry prompt.

## Cross-Field Validation with `argsValidator`

Use `argsValidator` for validation logic that goes beyond JSON schema — e.g., cross-field constraints or business rules.

```typescript
const bookingTool = tool({
  name: "book_flight",
  description: "Book a flight.",
  parameters: z.object({
    departureDate: z.string(),
    returnDate: z.string().optional(),
  }),
  argsValidator: async ({ departureDate, returnDate }) => {
    if (returnDate && returnDate < departureDate) {
      throw new Error("Return date must be after departure date.");
    }
  },
  execute: async (ctx, args) => doBookFlight(args),
});
```

`argsValidator` runs after schema validation and before `execute`. Throw to send an error message to the model without consuming a retry.

## Build Tools from Raw JSON Schema

Use `fromSchema` when integrating with external OpenAPI specs or JSON schema registries:

```typescript
import { fromSchema } from "@vibesjs/sdk";

const searchTool = fromSchema({
  name: "search",
  description: "Search documents",
  jsonSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  execute: async (ctx, args) => doSearch(args.query as string),
});
```

## Tool Metadata and `prepare`

Use `metadata` for arbitrary key-value pairs that affect tool routing but are not sent to the model:

```typescript
const adminTool = tool({
  name: "delete_user",
  description: "Delete a user account.",
  parameters: z.object({ userId: z.string() }),
  metadata: { requiresRole: "admin" },
  execute: async (ctx, { userId }) => deleteUser(userId),
});
```

Use `prepare` to conditionally hide or modify a tool before each turn:

```typescript
const conditionalTool = tool<{ phase: string }>({
  name: "submit",
  description: "Submit the result.",
  parameters: z.object({ value: z.string() }),
  prepare: async (ctx) => {
    // Return null to hide this tool from the model this turn
    if (ctx.deps.phase !== "submit") return null;
    return conditionalTool; // include as-is
  },
  execute: async (ctx, { value }) => doSubmit(value),
});
```

## Output Tools

Use `outputTool` or `isOutput: true` when the model calling this tool should immediately end the run:

```typescript
import { outputTool } from "@vibesjs/sdk";

const done = outputTool({
  name: "done",
  description: "Return the final answer.",
  parameters: z.object({ answer: z.string() }),
  execute: async (ctx, { answer }) => answer,
});
```

When the model calls an output tool, its return value becomes `result.output` and the run ends immediately.

## Sequential Tools

Use `sequential: true` to ensure a tool acquires a run-level mutex before executing — prevents concurrent execution with other sequential tools:

```typescript
const writeTool = tool({
  name: "write_file",
  description: "Write to a shared file.",
  parameters: z.object({ content: z.string() }),
  sequential: true,
  execute: async (ctx, { content }) => writeFile(content),
});
```
