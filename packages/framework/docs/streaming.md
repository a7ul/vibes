# Streaming

Call `.stream()` instead of `.run()` to receive text deltas as the model generates them. The response object exposes the text stream and separate promises for the final output, messages, and usage.

## Basic Streaming

```ts
const stream = agent.stream("Write a short story about a robot.");

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## `StreamResult<TOutput>`

`.stream()` returns a `StreamResult` immediately (synchronously). It has four properties:

| Property | Type | Description |
|---|---|---|
| `textStream` | `AsyncIterable<string>` | Text deltas as they arrive. Iterate with `for await`. |
| `output` | `Promise<TOutput>` | Resolves to the final output once the run completes. |
| `messages` | `Promise<CoreMessage[]>` | Resolves to the full message history. |
| `usage` | `Promise<Usage>` | Resolves to cumulative token usage. |

The promises resolve after the `textStream` is fully consumed (or after the run completes internally).

## Consuming the Stream

You **must** consume `textStream` (or the internal stream will not complete). Awaiting only `output` without consuming `textStream` will still work — the framework drains the stream internally — but you won't see intermediate text.

```ts
const stream = agent.stream("Summarise this article.");

// Option 1: consume and collect text manually
let text = "";
for await (const chunk of stream.textStream) {
  text += chunk;
}
const output = await stream.output;

// Option 2: skip text, just await output (stream drains internally)
const output = await stream.output;
```

## Streaming with Structured Output

When `outputSchema` is set, `textStream` emits the model's intermediate text (its reasoning/working). The final `output` promise resolves to the validated structured object.

```ts
const agent = new Agent<undefined, z.infer<typeof SummarySchema>>({
  model: ...,
  outputSchema: SummarySchema,
});

const stream = agent.stream("Summarise this document.");

// Stream the model's working
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

// Get the structured result
const summary = await stream.output;
console.log(summary.title);
console.log(summary.keyPoints);
```

## Usage and Messages

```ts
const stream = agent.stream("Hello.");

for await (const _ of stream.textStream) { /* drain */ }

const usage = await stream.usage;
console.log(usage.promptTokens);
console.log(usage.completionTokens);
console.log(usage.requests); // number of LLM calls made

const messages = await stream.messages;
// Pass to next run for multi-turn conversation
const next = agent.stream("Follow-up question", { messageHistory: messages });
```

## Multi-Turn Streaming

Streaming supports the same `deps` and `messageHistory` options as `.run()`:

```ts
const stream = agent.stream("Continue the story.", {
  deps: myDeps,
  messageHistory: previousMessages,
});
```

## Error Handling

If the run fails (e.g. model API error, `MaxTurnsError`, `MaxRetriesError`), the error surfaces when you await `stream.output`, `stream.messages`, or `stream.usage`. The `textStream` will also terminate.

```ts
try {
  const stream = agent.stream("Do something.");
  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }
  const output = await stream.output;
} catch (err) {
  if (err instanceof MaxTurnsError) {
    console.error("Agent hit the turn limit");
  }
}
```

## How It Works Internally

Each turn of the loop calls `streamText` (Vercel AI SDK) with `maxSteps: 1`. Text deltas are enqueued into a `ReadableStream` as they arrive. After the stream for a turn is consumed, tool calls and results are processed and the loop continues if needed. A deferred promise resolves the final output, messages, and usage once the loop completes.
