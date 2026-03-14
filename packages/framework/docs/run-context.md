# RunContext

`RunContext<TDeps>` is passed to every tool `execute` function, dynamic system
prompt, and result validator during a run. It gives you access to the current
dependencies, token usage, retry count, and a unique run ID.

## Interface

```ts
interface RunContext<TDeps = undefined> {
  deps: TDeps;
  usage: Usage;
  retryCount: number;
  toolName: string | null;
  runId: string;
}
```

## Fields

### `deps`

Your injected runtime dependencies. The type is `TDeps` — whatever you declared
as the first type parameter on `Agent<TDeps, TOutput>`.

```ts
execute: (async (ctx, args) => {
  const user = await ctx.deps.db.users.findById(args.userId);
  return user;
});
```

See [Dependencies](./dependencies.md) for full details.

---

### `usage`

Cumulative token usage for the current run, updated after each LLM call. Useful
for logging, rate limiting, or cost tracking inside a tool.

```ts
execute: (async (ctx, args) => {
  console.log(`Tokens used so far: ${ctx.usage.totalTokens}`);
  return doWork(args);
});
```

`Usage` is:

```ts
type Usage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requests: number; // number of LLM API calls made in this run
};
```

---

### `retryCount`

How many times the current result has been retried due to validation failures.
Starts at `0`. Increments each time a result validator throws or structured
output validation fails.

Useful for relaxing constraints on later retries:

```ts
resultValidators: [
  (ctx, output) => {
    if (ctx.retryCount < 2 && output.confidence < 0.9) {
      throw new Error("Confidence too low, please try again");
    }
    return output;
  },
],
```

---

### `toolName`

The name of the tool currently executing, or `null` when the context is used
outside of tool execution (e.g. in a dynamic system prompt or result validator).

```ts
execute: (async (ctx, args) => {
  console.log(`Running tool: ${ctx.toolName}`); // e.g. "search"
  return doWork(args);
});
```

---

### `runId`

A UUID generated once per `.run()` or `.stream()` call. Useful for correlating
logs, traces, or audit records across an entire multi-turn run.

```ts
execute: (async (ctx, args) => {
  logger.info({ runId: ctx.runId, tool: ctx.toolName }, "Tool called");
  return doWork(args);
});
```

---

## `RunResult<TOutput>`

Returned by `.run()`:

```ts
interface RunResult<TOutput> {
  output: TOutput; // the final typed result
  messages: CoreMessage[]; // full message history (user, assistant, tool turns)
  usage: Usage; // final cumulative usage
  retryCount: number; // total retries that occurred
  runId: string; // the run's unique ID
}
```

### Using `messages` for Multi-Turn Conversations

```ts
const first = await agent.run("Introduce yourself.");
const second = await agent.run("What did you just say?", {
  messageHistory: first.messages,
});
```

---

## `StreamResult<TOutput>`

Returned by `.stream()`:

```ts
interface StreamResult<TOutput> {
  textStream: AsyncIterable<string>;
  output: Promise<TOutput>;
  messages: Promise<CoreMessage[]>;
  usage: Promise<Usage>;
}
```

See [Streaming](./streaming.md) for full details.
