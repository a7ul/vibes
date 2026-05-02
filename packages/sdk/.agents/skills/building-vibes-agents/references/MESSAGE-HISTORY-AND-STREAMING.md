# Message History and Streaming

Read this file when the user wants to work with message history, continue conversations, use streaming, or process the typed event stream.

## Message History — Multi-Turn Conversations

Pass `messageHistory` to continue a conversation from a previous run:

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a helpful assistant.",
});

// First turn
const result1 = await agent.run("My name is Alice.");
console.log(result1.output); // "Hello Alice! How can I help you?"

// Continue the conversation
const result2 = await agent.run("What is my name?", {
  messageHistory: result1.messages,
});
console.log(result2.output); // "Your name is Alice."
```

### `result.messages` vs `result.newMessages`

| Property | Contains |
|---|---|
| `result.messages` | All messages (history + new messages from this run) |
| `result.newMessages` | Only messages added in this run |

Use `result.messages` for the next turn's `messageHistory`. Use `result.newMessages` when you want to persist only what changed.

## Streaming Text Output

Use `agent.stream()` for streaming text responses:

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "Be a creative storyteller.",
});

// Stream text chunks
for await (const chunk of agent.stream("Tell me a short story")) {
  process.stdout.write(chunk);
}
```

`agent.stream()` returns an `AsyncIterable<string>` yielding text deltas.

## Typed Event Stream

Use `agent.runStreamEvents()` for full observability — typed events for every agent action:

```typescript
import { Agent, AgentStreamEvent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  tools: [searchTool],
});

for await (const event of agent.runStreamEvents("Search for recent AI news")) {
  switch (event.kind) {
    case "text-delta":
      process.stdout.write(event.delta);
      break;
    case "tool-call":
      console.log(`\nCalling tool: ${event.toolName}`);
      console.log("Args:", event.args);
      break;
    case "tool-result":
      console.log("Result:", event.result);
      break;
  }
}
```

**Note:** Stream events use `.kind`, not `.type`. Always check `event.kind === "text-delta"`.

## Event Stream Handler

Use `eventStreamHandler` on `AgentOptions` or `RunOptions` for progress observation without consuming the event stream manually.

Observer form (gets events but doesn't transform them):

```typescript
import { Agent, AgentStreamEvent, RunContext } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  tools: [searchTool],
  eventStreamHandler: async (ctx, events) => {
    for await (const event of events) {
      if (event.kind === "tool-call") {
        console.log(`[${new Date().toISOString()}] Tool called: ${event.toolName}`);
      }
    }
  },
});

// Events are observed but the run proceeds normally
const result = await agent.run("Do the task");
```

Processor form (transforms the event stream — returns a new `AsyncIterable`):

```typescript
const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  eventStreamHandler: async function* (ctx, events) {
    for await (const event of events) {
      yield event; // pass through
      if (event.kind === "tool-call") {
        // Inject a synthetic status event
        yield { kind: "text-delta", delta: `\n[Calling ${event.toolName}...]\n` };
      }
    }
  },
});
```

## Accessing Messages Inside Tools

Tools can access the full message history via `ctx.messages`:

```typescript
import { tool } from "@vibesjs/sdk";
import { z } from "zod";

const summarizeTool = tool({
  name: "summarize_conversation",
  description: "Summarize the conversation so far.",
  parameters: z.object({}),
  execute: async (ctx) => {
    const messageCount = ctx.messages.length;
    return `Conversation has ${messageCount} messages.`;
  },
});
```

## History Processors

Use `historyProcessors` on `AgentOptions` to transform the message history before each turn. Useful for context window management (trimming, summarizing, compressing).

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  historyProcessors: [
    async (ctx, messages) => {
      // Keep only the last 20 messages
      if (messages.length > 20) {
        return messages.slice(messages.length - 20);
      }
      return messages;
    },
  ],
});
```

## Instructions vs System Prompt

- `systemPrompt` — passed to the model as the `system` parameter on every turn (not stored in message history)
- `instructions` — injected as user messages into the conversation history on each turn; useful for per-turn dynamic context that should appear in history

```typescript
const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a helpful assistant.",
  // instructions re-inject into conversation each turn:
  instructions: (ctx) => `Current date: ${new Date().toISOString()}`,
});
```
