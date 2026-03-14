---
title: "Message History"
description: "Multi-turn conversations, history processors, serialization"
---

Message history lets you persist conversation context across multiple agent runs
and control what gets sent to the model on each turn.

## `result.messages` vs `result.newMessages`

Every `RunResult` exposes two message properties:

| Property      | Type             | Description                                            |
| ------------- | ---------------- | ------------------------------------------------------ |
| `messages`    | `ModelMessage[]` | Full history: prior messages + messages added this run |
| `newMessages` | `ModelMessage[]` | Only messages added during this run                    |

Use `result.messages` to continue a multi-turn conversation:

```ts
const first = await agent.run("My name is Alice.");
const second = await agent.run("What is my name?", {
  messageHistory: first.messages,
});
console.log(second.output); // "Your name is Alice."
```

Use `result.newMessages` when you want to store only the delta - for example,
appending to a persistent log:

```ts
const result = await agent.run("Hello", { messageHistory: storedHistory });
await db.messages.insert(result.newMessages);
```

## Passing History Between Runs

Supply `messageHistory` in run options:

```ts
const result = await agent.run(userMessage, {
  messageHistory: previousMessages, // CoreMessage[]
  deps: myDeps,
});
```

For streaming:

```ts
const stream = agent.stream(userMessage, {
  messageHistory: previousMessages,
});
const messages = await stream.messages; // use for next turn
```

## History Processors

History processors transform the message list before each model call. They do
**not** mutate the stored history - they only filter what gets sent to the model
on that turn.

Register processors via `historyProcessors` on the agent:

```ts
import { Agent, trimHistoryProcessor } from "@vibes/framework";

const agent = new Agent({
  model,
  historyProcessors: [trimHistoryProcessor(20)],
});
```

Multiple processors are applied in order, each receiving the output of the
previous.

### `trimHistoryProcessor(maxMessages)`

Keeps only the `n` most recent messages. The simplest strategy for bounded
context.

```ts
import { trimHistoryProcessor } from "@vibes/framework";

const agent = new Agent({
  model,
  historyProcessors: [trimHistoryProcessor(30)],
});
```

### `tokenTrimHistoryProcessor(maxTokens, tokenCounter?)`

Keeps the most recent messages that fit within a token budget. System messages
are always preserved.

```ts
import { tokenTrimHistoryProcessor } from "@vibes/framework";

const agent = new Agent({
  model,
  historyProcessors: [tokenTrimHistoryProcessor(4000)],
});
```

Provide a custom token counter if you need accuracy:

```ts
import { encode } from "some-tiktoken-library";

const agent = new Agent({
  model,
  historyProcessors: [
    tokenTrimHistoryProcessor(
      4000,
      (msg) => encode(JSON.stringify(msg)).length,
    ),
  ],
});
```

### `summarizeHistoryProcessor(model, options?)`

When history exceeds `maxMessages`, uses an LLM to summarize the older portion.
The summary is injected as a single user message; the most recent half of
messages is kept verbatim.

```ts
import { summarizeHistoryProcessor } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";

const summaryModel = anthropic("claude-haiku-4-5-20251001");

const agent = new Agent({
  model,
  historyProcessors: [
    summarizeHistoryProcessor(summaryModel, { maxMessages: 40 }),
  ],
});
```

| Option            | Type     | Default                     | Description                               |
| ----------------- | -------- | --------------------------- | ----------------------------------------- |
| `maxMessages`     | `number` | `20`                        | Summarize when history exceeds this count |
| `summarizePrompt` | `string` | Default condensation prompt | Custom prompt for the summarizer model    |

### `privacyFilterProcessor(rules)`

Redacts sensitive data from message text before it reaches the model.

```ts
import { privacyFilterProcessor } from "@vibes/framework";

const agent = new Agent({
  model,
  historyProcessors: [
    privacyFilterProcessor([
      // Regex rule: replace credit card numbers
      { pattern: /\d{4}-\d{4}-\d{4}-\d{4}/g, replacement: "[CARD]" },
      // Field rule: remove a specific field from tool messages
      { messageType: "tool", fieldPath: "content.0.result.ssn" },
    ]),
  ],
});
```

**Regex rules** (`{ pattern, replacement? }`) - scan all string values in every
message recursively. `replacement` defaults to `"[REDACTED]"`.

**Field rules** (`{ messageType, fieldPath }`) - delete a field at a
dot-separated path from messages of the given role. Use numeric indices for
array positions, e.g. `"content.0.result.token"`.

## Writing a Custom History Processor

A history processor is any function matching:

```ts
type HistoryProcessor<TDeps = undefined> = (
  messages: ModelMessage[],
  ctx: RunContext<TDeps>,
) => ModelMessage[] | Promise<ModelMessage[]>;
```

Example - remove all tool-call messages older than 10 turns:

```ts
const dropOldToolCalls: HistoryProcessor = (messages) => {
  const cutoff = messages.length - 10;
  return messages.filter((m, i) => {
    if (i >= cutoff) return true;
    return m.role !== "tool";
  });
};

const agent = new Agent({ model, historyProcessors: [dropOldToolCalls] });
```

## Message Serialization

To persist messages across process restarts, serialize to JSON and deserialize
back. The `ModelMessage` type from the `ai` package is JSON-safe.

```ts
import type { ModelMessage } from "ai";

// Serialize
const json = JSON.stringify(result.messages);
await fs.writeTextFile("history.json", json);

// Deserialize
const raw = await fs.readTextFile("history.json");
const history: ModelMessage[] = JSON.parse(raw);

const next = await agent.run("Continue", { messageHistory: history });
```

The framework ships a `serializeMessages` / `deserializeMessages` helper pair
for safe round-tripping:

```ts
import { deserializeMessages, serializeMessages } from "@vibes/framework";

// Save
await db.set("history", serializeMessages(result.messages));

// Load
const history = deserializeMessages(await db.get("history"));
const next = await agent.run("Continue", { messageHistory: history });
```

## Error Behavior

- Passing `messageHistory` that contains malformed entries may cause the
  underlying model API to return a `400`. Validate history from external storage
  with `deserializeMessages`.
- `summarizeHistoryProcessor` makes a real API call on each turn where history
  exceeds the limit - factor in latency and cost.
- `privacyFilterProcessor` is applied to a copy of the messages; the original
  history is never mutated.
