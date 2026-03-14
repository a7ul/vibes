---
name: pydantic-ai-to-aisdk-ts
description: Patterns for porting pydantic-ai (Python) features to TypeScript using the Vercel AI SDK. Use when porting a pydantic-ai feature, adding a new capability to the vibes framework, or mapping pydantic-ai concepts to AI SDK equivalents.
origin: vibes-project
---

# Porting pydantic-ai → TypeScript (Vercel AI SDK)

This skill covers the patterns, decisions, and mappings used in the `vibes` project to port pydantic-ai's framework concepts to TypeScript with the Vercel AI SDK (`ai` package) and Zod.

## Framework Structure

```
src/packages/framework/
├── agent.ts                  # Agent class — main public entry point
├── tool.ts                   # ToolDefinition, tool(), toAISDKTools()
├── errors.ts                 # MaxTurnsError, MaxRetriesError
├── types/
│   ├── usage.ts              # Usage type (LanguageModelUsage + requests)
│   ├── run_context.ts        # RunContext<TDeps>
│   └── result.ts             # RunResult, StreamResult, ResultValidator
└── execution/
    ├── run.ts                # executeRun() — non-streaming turn loop
    ├── stream.ts             # executeStream() — streaming turn loop
    └── _run_utils.ts         # Shared helpers (internal only)
```

## Concept Mapping: pydantic-ai → AI SDK TypeScript

| pydantic-ai                                       | TypeScript equivalent                                     | Notes                                         |
| ------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| `Agent(model, system_prompt, tools, result_type)` | `new Agent({ model, systemPrompt, tools, outputSchema })` |                                               |
| `RunContext[Deps]`                                | `RunContext<TDeps>`                                       | Generic over deps                             |
| `@agent.tool` decorator                           | `tool({ name, description, parameters, execute })`        | Factory function                              |
| `result_type: BaseModel`                          | `outputSchema: z.object({...})`                           | Zod schema                                    |
| `ResultValidator`                                 | `ResultValidator<TDeps, TOutput>`                         | Throw to reject & retry                       |
| `agent.run(prompt, deps=x)`                       | `agent.run(prompt, { deps: x })`                          |                                               |
| `agent.run_stream(prompt)`                        | `agent.stream(prompt)`                                    |                                               |
| `result.data`                                     | `result.output`                                           |                                               |
| `result.usage()`                                  | `result.usage`                                            | Eager, not lazy                               |
| `AgentRunResult.all_messages()`                   | `result.messages`                                         |                                               |
| `ModelRetry` exception in tool                    | `throw` in tool execute                                   | Caught by maxRetries loop                     |
| `max_retries` on tool                             | `maxRetries` on `ToolDefinition`                          |                                               |
| `max_retries` on Agent                            | `maxRetries` on `AgentOptions`                            | Applies to result validators                  |
| `max_result_retries`                              | same `maxRetries`                                         |                                               |
| `@agent.system_prompt` decorator                  | `agent.addSystemPrompt((ctx) => ...)`                     | See decorator pattern below                   |
| `agent.name`                                      | `name` on `AgentOptions`                                  | Optional string                               |
| `ModelSettings`                                   | Pass options to AI SDK model constructor                  | e.g. `anthropic("claude-...", { maxTokens })` |

## Key Implementation Patterns

### 1. Tool with maxRetries

```typescript
result[t.name] = aiTool({
  description: t.description,
  parameters: t.parameters,
  execute: async (args: z.infer<ZodTypeAny>) => {
    const ctx = getCtx();
    const prev = ctx.toolName;
    ctx.toolName = t.name;
    const attempts = (t.maxRetries ?? 0) + 1;
    let lastErr: unknown;
    try {
      for (let i = 0; i < attempts; i++) {
        try {
          return await t.execute(ctx, args);
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr;
    } finally {
      ctx.toolName = prev;
    }
  },
});
```

### 2. Structured output via synthetic `final_result` tool

pydantic-ai forces structured output by injecting a tool called `final_result`. Replicate this:

```typescript
if (agent.outputSchema) {
  toolMap.final_result = aiTool({
    description: "Return the final structured result.",
    parameters: agent.outputSchema,
  });
}
```

Then in `processTurn`, detect `final_result` calls, Zod-parse the args, run result validators, and return `{ kind: "final-result", output }`.

### 3. Turn loop (non-streaming)

```
generateText({ maxSteps: 1 }) → processTurn → {
  no tool calls + no schema  → "text-result"
  no tool calls + schema     → nudge with message → "retry"
  final_result call          → validate → "final-result"
  other tool calls           → append results → "continue"
  turn >= maxTurns           → throw MaxTurnsError
}
```

Use `maxSteps: 1` to get one LLM call per loop iteration — we manage the multi-turn loop ourselves for full control.

### 4. Streaming

```typescript
// One streamText call per turn — consume textStream deltas, then await results
const stream = streamText({ model, system, messages, tools, maxSteps: 1 });
for await (const delta of stream.textStream) {
  controller.enqueue(delta);
}
const [text, usage, toolCalls, toolResults] = await Promise.all([
  stream.text,
  stream.usage,
  stream.toolCalls,
  stream.toolResults,
]);
```

Bridge `ReadableStream<string>` → `AsyncIterable<string>` manually (Deno's lib types don't expose ReadableStream as async-iterable):

```typescript
async function* readableToAsyncIterable(stream: ReadableStream<string>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
```

Use a **deferred promise** pattern to expose `output`, `messages`, `usage` as separate promises from a single background loop.

### 5. RunContext and TDeps

All execution components are generic over `TDeps`. The context flows through the entire call chain:

```typescript
interface RunContext<TDeps = undefined> {
  deps: TDeps; // user-supplied dependencies
  usage: Usage; // mutable, accumulates across turns
  retryCount: number; // mutable
  toolName: string | null;
  runId: string;
}
```

### 6. Types — use AI SDK exports, not custom wrappers

```typescript
import { type ToolSet } from "ai"; // ✓ for tool maps
// NOT: Record<string, any>         // ✗
// NOT: ReturnType<typeof aiTool>   // ✗
```

### 7. Pydantic-ai decorator pattern → `agent.add*`

pydantic-ai uses decorators to register dynamic behaviour on an agent after construction:

```python
@agent.system_prompt
def add_user_context(ctx: RunContext[Deps]) -> str:
    return f"User: {ctx.deps.username}"

@agent.tool
def search(ctx: RunContext[Deps], query: str) -> str:
    return ctx.deps.search_client.query(query)

@agent.result_validator
def check_score(ctx: RunContext[Deps], result: Output) -> Output:
    if result.score < 0: raise ModelRetry("Score must be positive")
    return result
```

In TypeScript there are no decorators, but the `agent.add*` methods are the direct equivalent. Call them after construction in the same pattern:

```typescript
// @agent.system_prompt
agent.addSystemPrompt((ctx) => `User: ${ctx.deps.username}`);
agent.addSystemPrompt(async (ctx) => {
  const user = await ctx.deps.db.users.findById(ctx.deps.userId);
  return `Preferences: ${JSON.stringify(user.prefs)}`;
});

// @agent.tool
agent.addTool(
  tool<Deps>({
    name: "search",
    description: "Search the knowledge base",
    parameters: z.object({ query: z.string() }),
    execute: async (ctx, { query }) => ctx.deps.searchClient.query(query),
  }),
);

// @agent.result_validator
agent.addResultValidator((_ctx, output) => {
  if (output.score < 0) throw new Error("Score must be positive");
  return output;
});
```

`systemPrompt` on `AgentOptions` also directly accepts functions (or a mixed array of strings and functions), so static and dynamic prompts are unified:

```typescript
const agent = new Agent<Deps>({
  model: ...,
  systemPrompt: [
    "You are a helpful assistant.",          // static
    (ctx) => `Current user: ${ctx.deps.username}`, // dynamic — same field
  ],
});
```

> **Key difference from pydantic-ai:** there is no `dynamic_system_prompt` constructor argument — `systemPrompt` accepts both. `agent.addSystemPrompt(fn)` is the decorator equivalent for post-construction registration.

### 8. Result validators

```typescript
type ResultValidator<TDeps, TOutput> = (
  ctx: RunContext<TDeps>,
  output: TOutput,
) => TOutput | Promise<TOutput>;
```

Throw from a validator to reject the output and force the model to retry (up to `maxRetries`). The thrown error message is fed back as a user message.

## What's NOT Yet Ported (backlog)

| pydantic-ai feature                | Status     | Notes                                              |
| ---------------------------------- | ---------- | -------------------------------------------------- |
| `UsageLimits` (token/request caps) | Not ported | Check usage in turn loop before calling model      |
| `Agent.override()` context manager | Not ported | Would override model/system/tools for a single run |
| `capture_run_messages()`           | Not ported |                                                    |
| `TestModel` / `FunctionModel`      | Not ported | Needed for unit tests without API calls            |
| Streaming result validators        | Not ported | Currently validators only run after full output    |
| `agent.last_run_messages`          | Not ported |                                                    |
| Multi-agent orchestration          | Not ported | pydantic-ai allows passing agents as tools         |

## Testing a Ported Feature

Tests live in `src/packages/framework/tests/`. Use `ai/test` — no real API key needed.

### Import map entry (required)

```jsonc
{ "imports": { "ai/test": "npm:ai@^4/test" } }
```

Run with: `deno test --allow-env src/packages/framework/tests/`

### Helper types

```typescript
import {
  MockLanguageModelV1,
  convertArrayToReadableStream,
  mockValues,
} from "ai/test";

type DoGenerateResult = Awaited<ReturnType<MockLanguageModelV1["doGenerate"]>>;
type DoStreamResult = Awaited<ReturnType<MockLanguageModelV1["doStream"]>>;
```

### Response builder patterns

```typescript
const rawCall = { rawPrompt: null, rawSettings: {} };
const usage = { promptTokens: 10, completionTokens: 5 };

// Plain text
const textResponse = (text: string): DoGenerateResult => ({
  text,
  finishReason: "stop",
  usage,
  rawCall,
});

// Tool call (including final_result for structured output)
const toolCallResponse = (
  toolName: string,
  args: unknown,
  toolCallId = "tc1",
): DoGenerateResult => ({
  toolCalls: [
    {
      toolCallType: "function",
      toolCallId,
      toolName,
      args: JSON.stringify(args),
    },
  ],
  finishReason: "tool-calls",
  usage,
  rawCall,
});

// Stream: text
const textStream = (text: string): DoStreamResult => ({
  stream: convertArrayToReadableStream([
    { type: "text-delta", textDelta: text },
    { type: "finish", finishReason: "stop", usage },
  ]),
  rawCall,
});

// Stream: tool call
const toolCallStream = (
  toolName: string,
  args: unknown,
  toolCallId = "tc1",
): DoStreamResult => ({
  stream: convertArrayToReadableStream([
    {
      type: "tool-call",
      toolCallType: "function",
      toolCallId,
      toolName,
      args: JSON.stringify(args),
    },
    { type: "finish", finishReason: "tool-calls", usage },
  ]),
  rawCall,
});
```

### Multi-turn with mockValues

```typescript
const doGenerate = mockValues<DoGenerateResult>(
  toolCallResponse("my_tool", { arg: "value" }), // turn 1
  textResponse("Final answer."), // turn 2
);
const model = new MockLanguageModelV1({
  doGenerate: () => Promise.resolve(doGenerate()),
});
```

### What to test for every new feature

- Happy path (feature works as expected)
- The retry/fallback path (validator rejects, tool fails, model doesn't call final_result)
- That `result.usage.requests` matches expected turn count
- That `result.messages` has the right length
- Inspect what the model received via `doGenerate: (opts) => { /* opts.prompt */ }`

## Documenting a Ported Feature

Docs live in `src/packages/framework/docs/`. Mirror the pydantic-ai docs style: concept first, API reference table, then progressively complex examples.

### Doc file structure

```markdown
# Feature Name

One-sentence summary of what it does.

## Basic Usage

Minimal working example — copy-pasteable.

## API Reference

Table: option | type | default | description

## Type Parameters (if generic)

Explain TDeps / TOutput interaction.

## Recipes

Named subsections for common patterns:

- "With Dependencies"
- "Async validators"
- "Combining with Tools"
- etc.

## Error Behaviour

What throws, when, and how to handle it.
```

### Link from index.md

Add a row to the table in `docs/index.md`:

```markdown
- [**Feature Name**](./feature-name.md) — one-line description
```

## Porting a New Feature — Checklist

1. Find the pydantic-ai source (`pydantic_ai/agent.py` or `pydantic_ai/_run.py`)
2. Map Python types → TypeScript generics (Pydantic models → Zod schemas)
3. Map Python context managers → async functions or class methods
4. Keep types strictly from `ai` and `zod` — no `any`, no custom wrappers
5. Add to `AgentOptions` interface if it's a constructor option
6. Export new public types from `mod.ts`
7. Run `deno check mod.ts` to verify
8. Write tests in `src/packages/framework/tests/` using `MockLanguageModelV1`
9. Write a doc page in `src/packages/framework/docs/` following the structure above
10. Link the doc page from `docs/index.md`

## Runtime: Deno + npm imports

```jsonc
// deno.json
{
  "imports": {
    "ai": "npm:ai@^4",
    "zod": "npm:zod@^3",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@^1",
  },
}
```

Import npm packages with `npm:` prefix or via the import map. Use `deno check` (not `tsc`) for type checking.
