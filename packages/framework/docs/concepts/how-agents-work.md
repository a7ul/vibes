---
title: "How Agents Work"
description: "The agent loop, turns, and message history explained"
---

# How Agents Work

Understanding the agent loop helps you write better agents, debug issues, and optimize performance.

## The Agent Loop

Every call to `agent.run()` runs this loop:

```
┌─────────────────────────────────────────────────────────┐
│  agent.run(prompt, opts)                                 │
│                                                         │
│  1. Resolve system prompt (static + dynamic functions)  │
│  2. Build initial messages: [system?, user]             │
│     + prepend messageHistory if provided                │
│                                                         │
│  ┌───────────────── Agent Loop ──────────────────────┐  │
│  │                                                   │  │
│  │  prepareTurn()                                    │  │
│  │    - resolve toolsets → get ToolDefinition[]      │  │
│  │    - call prepare() on each tool (per-turn filter)│  │
│  │    - apply historyProcessors to messages          │  │
│  │                                                   │  │
│  │  generateText() [Vercel AI SDK]                   │  │
│  │    - sends messages + tools to the model          │  │
│  │    - waits for response                           │  │
│  │                                                   │  │
│  │  Process response:                                │  │
│  │    If text only → output = text, END              │  │
│  │    If tool calls →                                │  │
│  │      execute tools concurrently                   │  │
│  │      (sequential tools use mutex)                 │  │
│  │      append tool results to messages              │  │
│  │      turn++ → loop                                │  │
│  │    If final_result tool →                         │  │
│  │      validate against outputSchema                │  │
│  │      run resultValidators                         │  │
│  │      END                                          │  │
│  │                                                   │  │
│  │  If turn >= maxTurns → throw MaxTurnsError        │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Return RunResult<TOutput>                              │
└─────────────────────────────────────────────────────────┘
```

## Turns

A **turn** is one round-trip to the model. Each turn:
1. Sends the accumulated message history
2. Receives a response (text, tool calls, or both)
3. If tool calls were made, executes them and appends results
4. Increments the turn counter

The default `maxTurns` is 10. Increase it for complex multi-tool workflows, decrease it for cost control.

```ts
const agent = new Agent({
  model,
  maxTurns: 20,  // allow up to 20 turns
});
```

## Messages

Vibes uses the AI SDK's `ModelMessage` type. The message history accumulates across turns:

```
Turn 0:
  [system, user]

Turn 1 (after tool call):
  [system, user, assistant(tool_calls), tool_results]

Turn 2 (after second tool call):
  [system, user, assistant(tool_calls), tool_results, assistant(tool_calls), tool_results]

Final:
  [system, user, ..., assistant(text)]
```

`result.messages` contains the full history. `result.newMessages` contains only the messages added in this run (useful for multi-turn conversations).

## History Processors

History processors run before every model call and can transform the message list. They do not mutate messages — they return new arrays.

```ts
import { trimHistoryProcessor } from "@vibes/framework";

const agent = new Agent({
  model,
  historyProcessors: [
    trimHistoryProcessor(20),  // send at most 20 messages per turn
  ],
});
```

Built-in processors:
- `trimHistoryProcessor(n)` — keep the last n messages
- `tokenTrimHistoryProcessor(maxTokens)` — trim to stay under a token budget
- `summarizeHistoryProcessor(...)` — replace old messages with a summary

See [Message History](../reference/advanced/message-history) for full details.

## System Prompt Resolution

Both `systemPrompt` and `instructions` are resolved before the first turn:

1. `systemPrompt` is evaluated (string returned as-is, function called with `RunContext`)
2. `instructions` is evaluated the same way
3. Both are joined and injected as the system message

`instructions` is the escape hatch for per-run dynamic content. It maps to pydantic-ai's `instructions` parameter — a function that runs every turn with the current `RunContext`.

## Tool Execution

When the model returns tool calls, Vibes:

1. Looks up each tool by name
2. Validates the model's arguments against the tool's Zod schema
3. Runs `argsValidator` if defined
4. Calls `execute(ctx, args)` — concurrently for all tools in the turn
5. If `sequential: true` on a tool, acquires the run-level mutex first
6. Appends all results to the message history
7. Checks endStrategy

### endStrategy

- `"early"` (default): Stop as soon as one response ends the run, even if other tools were called
- `"exhaustive"`: Run all tool calls in the current turn before checking for completion

### maxConcurrency

Limit how many tools execute in parallel per turn:

```ts
const agent = new Agent({
  model,
  maxConcurrency: 3,  // at most 3 tools run at once
});
```

## Deferred Tools (Human-in-the-Loop)

Tools marked with `requiresApproval: true` pause the run. Instead of executing, Vibes throws an `ApprovalRequiredError` containing the pending tool calls.

```ts
try {
  const result = await agent.run(prompt);
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    // Show err.deferred.requests to the user
    // Then resume:
    const result = await agent.resume(err.deferred, {
      results: [{ toolCallId: "tc1", result: "approved" }],
    });
  }
}
```

See [Deferred Tools](../reference/advanced/deferred-tools) for the full pattern.

## RunContext

Every execution creates a `RunContext<TDeps>`. It's available in:
- `execute(ctx, args)` on tools
- `systemPrompt(ctx)` and `instructions(ctx)` dynamic functions
- `resultValidators`

```ts
interface RunContext<TDeps> {
  deps: TDeps;          // your injected dependencies
  usage: Usage;         // token usage accumulated so far
  runId: string;        // unique ID for this run
  metadata: Record<string, unknown>;  // arbitrary run metadata
}
```

## RunResult

`agent.run()` returns `RunResult<TOutput>`:

```ts
interface RunResult<TOutput> {
  output: TOutput;              // the final answer (string or typed schema)
  usage: UsageSummary;          // total tokens and requests used
  messages: ModelMessage[];     // full conversation history
  newMessages: ModelMessage[];  // only messages added in this run
  runId: string;                // unique run identifier
}
```

## Streaming

`agent.stream()` runs the same loop but makes the model's output available as it arrives. See [Streaming](../reference/core/streaming).

## Error Flow

| Error | When | Recovery |
|-------|------|----------|
| `MaxTurnsError` | Turn count exceeded | Increase `maxTurns` or simplify the task |
| `MaxRetriesError` | Validation retries exhausted | Check your `outputSchema` and `resultValidators` |
| `ApprovalRequiredError` | Tool needs human approval | Call `agent.resume()` |
| `UsageLimitExceededError` | Token/request budget hit | Increase limits or add history processors |
| Provider errors | Model API failure | Retry or handle in calling code |

See [Error Handling](./error-handling.md) for the full pattern guide.
