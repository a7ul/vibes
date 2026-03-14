# Agents

An `Agent` is the central object in Vibes. It holds a model, system prompts,
tools, an optional output schema, and result validators. You call `.run()` or
`.stream()` on it to execute a prompt.

## Creating an Agent

```ts
import { Agent } from "./mod.ts";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful assistant.",
});
```

## `AgentOptions`

| Option                | Type                                 | Default  | Description                                                          |
| --------------------- | ------------------------------------ | -------- | -------------------------------------------------------------------- |
| `model`               | `LanguageModelV1`                    | required | Any Vercel AI SDK model                                              |
| `name`                | `string`                             | —        | Human-readable label for the agent                                   |
| `systemPrompt`        | `string \| string[]`                 | —        | Static system prompt(s), joined with `\n\n`                          |
| `dynamicSystemPrompt` | `SystemPromptFn \| SystemPromptFn[]` | —        | Function(s) called at run time with [`RunContext`](./run-context.md) |
| `tools`               | `ToolDefinition[]`                   | —        | Tools the model can call                                             |
| `outputSchema`        | `ZodTypeAny`                         | —        | Zod schema for structured output                                     |
| `resultValidators`    | `ResultValidator[]`                  | —        | Validators run after output is parsed                                |
| `maxRetries`          | `number`                             | `3`      | Max retries for validation failures                                  |
| `maxTurns`            | `number`                             | `10`     | Max tool-call round trips per run                                    |

## Type Parameters

```ts
class Agent<TDeps = undefined, TOutput = string>
```

- **`TDeps`** — the type of dependencies injected at run time via `deps`.
  Defaults to `undefined` (no deps).
- **`TOutput`** — the type of `result.output`. Defaults to `string`. Set by
  providing an `outputSchema`.

```ts
type Deps = { db: Database };
const agent = new Agent<Deps, MyOutput>({
  model: ...,
  outputSchema: MyOutputSchema,
});
```

## Running an Agent

### `.run(prompt, opts?)`

Executes the agent and waits for the final result.

```ts
const result = await agent.run("What is the capital of France?");
console.log(result.output); // "Paris"
console.log(result.usage); // { promptTokens, completionTokens, totalTokens, requests }
console.log(result.messages); // full CoreMessage[] history
console.log(result.runId); // unique run identifier
```

**Options:**

| Option           | Type            | Description                                                  |
| ---------------- | --------------- | ------------------------------------------------------------ |
| `deps`           | `TDeps`         | Runtime dependencies passed to tools and dynamic prompts     |
| `messageHistory` | `CoreMessage[]` | Prior messages to prepend (enables multi-turn conversations) |

Returns [`RunResult<TOutput>`](./run-context.md#runresult).

### `.stream(prompt, opts?)`

Starts the agent and returns a [`StreamResult`](./streaming.md) immediately.
Text deltas are available as an async iterable.

```ts
const stream = agent.stream("Tell me a story.");

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

const output = await stream.output;
```

Same options as `.run()`. See [Streaming](./streaming.md) for full details.

## Mutating an Agent After Construction

You can add tools, system prompts, and result validators after construction.
This is useful for building agents incrementally or in middleware patterns.

```ts
agent.addTool(myTool);
agent.addSystemPrompt("Always respond in bullet points.");
agent.addSystemPrompt((ctx) => `User ID: ${ctx.deps.userId}`);
agent.addResultValidator(myValidator);
```

## System Prompts

Multiple static and dynamic prompts can be provided. They are all joined with
`\n\n` at run time.

```ts
const agent = new Agent({
  model: ...,
  systemPrompt: [
    "You are a helpful assistant.",
    "Always cite your sources.",
  ],
  dynamicSystemPrompt: (ctx) => `Today's date: ${new Date().toISOString()}`,
});
```

Dynamic prompts receive a [`RunContext`](./run-context.md) and can return a
`string` or `Promise<string>`.

```ts
type SystemPromptFn<TDeps> = (
  ctx: RunContext<TDeps>,
) => string | Promise<string>;
```

## Model Selection

Any model implementing `LanguageModelV1` from the Vercel AI SDK works:

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

// Anthropic
const agent = new Agent({ model: anthropic("claude-sonnet-4-6") });

// OpenAI
const agent = new Agent({ model: openai("gpt-4o") });
```

Pass model-specific options (temperature, max tokens, etc.) directly to the
provider constructor — they are forwarded to the API automatically.

## Multi-Turn Conversations

Pass `result.messages` from one run as `messageHistory` in the next:

```ts
const first = await agent.run("My name is Alice.");
const second = await agent.run("What is my name?", {
  messageHistory: first.messages,
});
console.log(second.output); // "Your name is Alice."
```

## Turn Limit

Each call to `.run()` or `.stream()` runs an internal loop: one LLM call per
turn, with tool results appended and the loop repeated until the model produces
a final answer or `maxTurns` is exceeded.

If `maxTurns` is reached, a [`MaxTurnsError`](./errors.md) is thrown.

```ts
const agent = new Agent({ model: ..., maxTurns: 5 });
```

## `instructions` vs `systemPrompt`

Both configure the agent's system instructions, but they are evaluated
differently:

- `systemPrompt` — a static string (or array of strings). All strings are joined
  with `\n\n` before the run starts.
- `instructions` — a dynamic function called with the `RunContext` on every run,
  **after** `systemPrompt` is resolved. Use it when instructions must reference
  run-time data.

```ts
const agent = new Agent<{ locale: string }>({
  model,
  systemPrompt: "You are a helpful assistant.",
  instructions: (ctx) => `Always respond in ${ctx.deps.locale}.`,
});
```

Both can be combined. The resolved `instructions` string is appended after the
resolved `systemPrompt`.

## `endStrategy`

Controls when the agent considers a run complete after a tool-only turn:

| Value | Behaviour |
| --- | --- |
| `"early"` (default) | Stop as soon as the model produces a text response or output tool call, even if other tools were also called this turn |
| `"exhaustive"` | Run all tool calls in the current turn before checking for completion |

```ts
const agent = new Agent({ model, endStrategy: "exhaustive" });
```

Use `"exhaustive"` when your tools have side effects that all need to complete
before the model summarises.

## `maxConcurrency`

Limits how many tools execute in parallel within a single turn. Defaults to
unlimited.

```ts
const agent = new Agent({
  model,
  tools: [searchTool, fetchTool, parseTool],
  maxConcurrency: 2, // at most 2 tools run at once
});
```

Combined with `sequential: true` on individual tools, this gives fine-grained
control over execution order.

## `runStreamEvents()`

For detailed event-by-event observation of a run (tool calls, tool results,
text deltas, completion), use `runStreamEvents()`. See
[Streaming](./streaming.md#runstreamevents) for the full event type reference.

```ts
for await (const event of agent.runStreamEvents("Tell me a joke.")) {
  if (event.type === "text-delta") process.stdout.write(event.delta);
  if (event.type === "tool-call") console.log("called", event.toolName);
  if (event.type === "run-complete") console.log("done", event.result.output);
}
```
