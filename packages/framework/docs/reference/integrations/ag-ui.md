---
title: "AG-UI"
description: "Server-Sent Events adapter for AG-UI protocol"
---

# AG-UI

The AG-UI adapter streams agent runs as Server-Sent Events (SSE) following the
[AG-UI protocol](https://docs.ag-ui.com/), making any Vibes agent compatible
with AG-UI frontends.

## What is AG-UI?

AG-UI is an open protocol for streaming AI agent output to web frontends. It
defines a set of typed SSE events (text deltas, tool calls, state snapshots, run
lifecycle) that frontends can consume without knowing the underlying agent
framework.

## Basic Usage

Wrap your agent with `AGUIAdapter` and call `handleRequest()` from your HTTP
handler:

```ts
import { AGUIAdapter } from "@vibes/framework";
import { Agent } from "@vibes/framework";

const agent = new Agent({
  model,
  systemPrompt: "You are a helpful assistant.",
});

const adapter = new AGUIAdapter(agent);

// Deno HTTP server
Deno.serve((req) => {
  if (req.method === "POST" && new URL(req.url).pathname === "/agent") {
    return adapter.handleRequest(req);
  }
  return new Response("Not found", { status: 404 });
});
```

The adapter reads the request body as `AGUIRunInput`, runs the agent, and
streams SSE events back to the client.

## `AGUIRunInput`

The request body must be JSON with this shape:

| Field      | Type                                 | Description                                            |
| ---------- | ------------------------------------ | ------------------------------------------------------ |
| `threadId` | `string`                             | Client-supplied thread ID for multi-turn continuations |
| `runId`    | `string` (optional)                  | Run identifier; auto-generated when omitted            |
| `messages` | `AGUIMessage[]`                      | Conversation history including the latest user message |
| `state`    | `Record<string, unknown>` (optional) | Initial state emitted in `STATE_SNAPSHOT` event        |

```ts
// Example POST body
{
  "threadId": "thread-abc123",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

## `AGUIMessage`

| Field     | Type                    | Description  |
| --------- | ----------------------- | ------------ |
| `role`    | `"user" \| "assistant"` | Message role |
| `content` | `string`                | Message text |

## SSE Event Types

The adapter emits these events in order during a run:

| Event type             | Description                                   |
| ---------------------- | --------------------------------------------- |
| `RUN_STARTED`          | Run began; includes `threadId` and `runId`    |
| `STATE_SNAPSHOT`       | Initial state (if `state` was in the request) |
| `TEXT_MESSAGE_START`   | Model started generating a text response      |
| `TEXT_MESSAGE_CONTENT` | Text delta chunk                              |
| `TEXT_MESSAGE_END`     | Model finished generating text for this turn  |
| `TOOL_CALL_START`      | Model called a tool                           |
| `TOOL_CALL_END`        | Tool returned a result                        |
| `RUN_FINISHED`         | Run completed successfully                    |
| `RUN_ERROR`            | Run failed with an error                      |

## Multi-Turn Conversations

The adapter uses `threadId` to manage history. Supply all previous messages in
the `messages` array (the adapter converts them to `CoreMessage[]` internally):

```ts
// Client sends accumulated history on each request
{
  "threadId": "thread-abc123",
  "messages": [
    { "role": "user", "content": "My name is Alice." },
    { "role": "assistant", "content": "Hello Alice!" },
    { "role": "user", "content": "What is my name?" }
  ]
}
```

## Recipes

### With Dependencies

Pass a `depsFactory` to inject runtime dependencies from the HTTP request:

```ts
const adapter = new AGUIAdapter(agent, {
  depsFactory: (req) => ({
    userId: req.headers.get("x-user-id") ?? "anonymous",
    db: getDb(),
  }),
});
```

### CORS Headers

```ts
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method === "POST" && new URL(req.url).pathname === "/agent") {
    const response = adapter.handleRequest(req);
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  }

  return new Response("Not found", { status: 404 });
});
```

## API Reference

### `AGUIAdapter`

| Member          | Signature                    | Description                              |
| --------------- | ---------------------------- | ---------------------------------------- |
| constructor     | `(agent, options?)`          | Wrap an agent                            |
| `handleRequest` | `(req: Request) => Response` | Handle a POST request, return SSE stream |

### `AGUIAdapter` Options

| Option        | Type                      | Description                        |
| ------------- | ------------------------- | ---------------------------------- |
| `depsFactory` | `(req: Request) => TDeps` | Extract deps from the HTTP request |

## Error Behavior

- Invalid JSON request body: adapter returns `400 Bad Request`.
- Agent run errors: a `RUN_ERROR` SSE event is emitted, then the stream closes.
  The HTTP status is `200` (SSE streams must start with 200 before errors can
  occur mid-stream).
- Disconnected clients: the adapter detects `req.signal.aborted` and stops
  streaming gracefully.
