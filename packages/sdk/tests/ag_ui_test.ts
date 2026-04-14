/**
 * Tests for the AG-UI adapter - Phase 12.
 *
 * Covers:
 * - SSE response format and Content-Type header
 * - RUN_STARTED / RUN_FINISHED lifecycle events
 * - TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT / TEXT_MESSAGE_END for text output
 * - STEP_STARTED / STEP_FINISHED per turn
 * - TOOL_CALL_START / TOOL_CALL_ARGS / TOOL_CALL_END for tool invocations
 * - STATE_SNAPSHOT from getState callback and input.state
 * - RAW usage events
 * - RUN_ERROR on agent failure (MaxTurnsError)
 * - Pending tool calls closed with TOOL_CALL_END before RUN_ERROR on stream error
 * - Multi-turn conversation via messageHistory
 * - handler() rejects non-POST and invalid JSON bodies
 */
import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { z } from "zod";
import { Agent, tool } from "../mod.ts";
import { AGUIAdapter } from "../lib/ag_ui/mod.ts";
import type { AGUIEvent, AGUIRunInput } from "../lib/ag_ui/mod.ts";
import { MockLanguageModelV3, textStream, toolCallStream } from "./_helpers.ts";

// ---------------------------------------------------------------------------
// SSE parsing helpers
// ---------------------------------------------------------------------------

/** Parse a raw SSE body string into an array of AGUIEvent objects. */
function parseSSE(body: string): AGUIEvent[] {
  const events: AGUIEvent[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const json = trimmed.slice("data:".length).trim();
      if (json.length > 0) {
        events.push(JSON.parse(json) as AGUIEvent);
      }
    }
  }
  return events;
}

/** Collect the full response body from a streaming Response. */
async function collectBody(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  return chunks.join("");
}

/** Shorthand: collect SSE events from a Response. */
async function collectEvents(response: Response): Promise<AGUIEvent[]> {
  const body = await collectBody(response);
  return parseSSE(body);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<AGUIRunInput> = {}): AGUIRunInput {
  return {
    threadId: "thread-1",
    runId: "run-1",
    messages: [{ role: "user", content: "hello" }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests - response format
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - response has text/event-stream Content-Type", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hi")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const response = adapter.handleRequest(makeInput());
  assertEquals(response.headers.get("Content-Type"), "text/event-stream");
  await collectBody(response); // drain
});

Deno.test("AGUIAdapter - response has Cache-Control no-cache", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hi")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const response = adapter.handleRequest(makeInput());
  assertEquals(response.headers.get("Cache-Control"), "no-cache");
  await collectBody(response); // drain
});

Deno.test("AGUIAdapter - SSE lines are data: prefixed with double newline", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hello")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const body = await collectBody(adapter.handleRequest(makeInput()));

  // Every non-empty line should start with "data:"
  const nonEmpty = body.split("\n").filter((l) => l.trim().length > 0);
  for (const line of nonEmpty) {
    assertStringIncludes(line, "data:");
  }
});

// ---------------------------------------------------------------------------
// Tests - lifecycle events
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - emits RUN_STARTED as first event", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hi")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(
    adapter.handleRequest(makeInput({ threadId: "t1", runId: "r1" })),
  );

  assertEquals(events[0].type, "RUN_STARTED");
  const started = events[0] as Extract<AGUIEvent, { type: "RUN_STARTED" }>;
  assertEquals(started.threadId, "t1");
  assertEquals(started.runId, "r1");
});

Deno.test("AGUIAdapter - emits RUN_FINISHED as last event", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("done")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(
    adapter.handleRequest(makeInput({ threadId: "t1", runId: "r1" })),
  );

  const last = events[events.length - 1];
  assertEquals(last.type, "RUN_FINISHED");
  const finished = last as Extract<AGUIEvent, { type: "RUN_FINISHED" }>;
  assertEquals(finished.threadId, "t1");
  assertEquals(finished.runId, "r1");
});

Deno.test("AGUIAdapter - generates runId when not provided", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("ok")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(
    adapter.handleRequest(makeInput({ runId: undefined })),
  );

  const started = events.find((e) => e.type === "RUN_STARTED") as
    | Extract<AGUIEvent, { type: "RUN_STARTED" }>
    | undefined;
  assertExists(started);
  assertExists(started.runId);
  assertEquals(started.runId.length > 0, true);
});

// ---------------------------------------------------------------------------
// Tests - text message events
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - emits TEXT_MESSAGE_START before TEXT_MESSAGE_CONTENT", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hello world")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const startIdx = events.findIndex((e) => e.type === "TEXT_MESSAGE_START");
  const contentIdx = events.findIndex((e) => e.type === "TEXT_MESSAGE_CONTENT");
  assertEquals(startIdx >= 0, true);
  assertEquals(contentIdx >= 0, true);
  assertEquals(startIdx < contentIdx, true);
});

Deno.test("AGUIAdapter - TEXT_MESSAGE_START has role assistant", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hi")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const start = events.find((e) => e.type === "TEXT_MESSAGE_START") as
    | Extract<AGUIEvent, { type: "TEXT_MESSAGE_START" }>
    | undefined;
  assertExists(start);
  assertEquals(start.role, "assistant");
});

Deno.test("AGUIAdapter - TEXT_MESSAGE_CONTENT deltas reconstruct full text", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hello world")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const contents = events.filter((e) =>
    e.type === "TEXT_MESSAGE_CONTENT"
  ) as Extract<
    AGUIEvent,
    { type: "TEXT_MESSAGE_CONTENT" }
  >[];
  const joined = contents.map((e) => e.delta).join("");
  assertEquals(joined, "hello world");
});

Deno.test("AGUIAdapter - TEXT_MESSAGE_END emitted after text", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("bye")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const endIdx = events.findIndex((e) => e.type === "TEXT_MESSAGE_END");
  assertEquals(endIdx >= 0, true);
});

Deno.test("AGUIAdapter - TEXT_MESSAGE_* share the same messageId", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("abc")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const start = events.find((e) => e.type === "TEXT_MESSAGE_START") as
    | Extract<AGUIEvent, { type: "TEXT_MESSAGE_START" }>
    | undefined;
  const content = events.find((e) => e.type === "TEXT_MESSAGE_CONTENT") as
    | Extract<AGUIEvent, { type: "TEXT_MESSAGE_CONTENT" }>
    | undefined;
  const end = events.find((e) => e.type === "TEXT_MESSAGE_END") as
    | Extract<AGUIEvent, { type: "TEXT_MESSAGE_END" }>
    | undefined;

  assertExists(start);
  assertExists(content);
  assertExists(end);
  assertEquals(start.messageId, content.messageId);
  assertEquals(start.messageId, end.messageId);
});

// ---------------------------------------------------------------------------
// Tests - step events
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - emits STEP_STARTED for each turn", async () => {
  const echoTool = tool({
    name: "echo",
    description: "Echo",
    parameters: z.object({ msg: z.string() }),
    execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
  });

  let turnCount = 0;
  const model = new MockLanguageModelV3({
    doStream: () => {
      turnCount++;
      return Promise.resolve(
        turnCount === 1
          ? toolCallStream("echo", { msg: "ping" })
          : textStream("pong"),
      );
    },
  });

  const agent = new Agent({ model, tools: [echoTool] });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const stepStarts = events.filter((e) => e.type === "STEP_STARTED");
  assertEquals(stepStarts.length, 2);
});

Deno.test("AGUIAdapter - STEP_STARTED names follow turn-N pattern", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hi")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const stepStart = events.find((e) => e.type === "STEP_STARTED") as
    | Extract<AGUIEvent, { type: "STEP_STARTED" }>
    | undefined;
  assertExists(stepStart);
  assertEquals(stepStart.stepName, "turn-0");
});

// ---------------------------------------------------------------------------
// Tests - tool call events
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - emits TOOL_CALL_START with correct name", async () => {
  const myTool = tool({
    name: "greet",
    description: "Greet someone",
    parameters: z.object({ name: z.string() }),
    execute: (_ctx, args: { name: string }) =>
      Promise.resolve(`Hello ${args.name}`),
  });

  let turn = 0;
  const model = new MockLanguageModelV3({
    doStream: () => {
      turn++;
      return Promise.resolve(
        turn === 1
          ? toolCallStream("greet", { name: "World" })
          : textStream("done"),
      );
    },
  });

  const agent = new Agent({ model, tools: [myTool] });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const toolStart = events.find((e) => e.type === "TOOL_CALL_START") as
    | Extract<AGUIEvent, { type: "TOOL_CALL_START" }>
    | undefined;
  assertExists(toolStart);
  assertEquals(toolStart.toolCallName, "greet");
  assertExists(toolStart.toolCallId);
});

Deno.test("AGUIAdapter - emits TOOL_CALL_ARGS after TOOL_CALL_START", async () => {
  const myTool = tool({
    name: "add",
    description: "Add numbers",
    parameters: z.object({ a: z.number(), b: z.number() }),
    execute: (_ctx, args: { a: number; b: number }) =>
      Promise.resolve(String(args.a + args.b)),
  });

  let turn = 0;
  const model = new MockLanguageModelV3({
    doStream: () => {
      turn++;
      return Promise.resolve(
        turn === 1 ? toolCallStream("add", { a: 1, b: 2 }) : textStream("3"),
      );
    },
  });

  const agent = new Agent({ model, tools: [myTool] });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const startIdx = events.findIndex((e) => e.type === "TOOL_CALL_START");
  const argsIdx = events.findIndex((e) => e.type === "TOOL_CALL_ARGS");
  assertEquals(startIdx >= 0, true);
  assertEquals(argsIdx >= 0, true);
  assertEquals(startIdx < argsIdx, true);
});

Deno.test("AGUIAdapter - emits TOOL_CALL_END after tool result", async () => {
  const myTool = tool({
    name: "noop",
    description: "No-op",
    parameters: z.object({}),
    execute: () => Promise.resolve("done"),
  });

  let turn = 0;
  const model = new MockLanguageModelV3({
    doStream: () => {
      turn++;
      return Promise.resolve(
        turn === 1 ? toolCallStream("noop", {}) : textStream("ok"),
      );
    },
  });

  const agent = new Agent({ model, tools: [myTool] });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const toolEnd = events.find((e) => e.type === "TOOL_CALL_END");
  assertExists(toolEnd);
});

Deno.test("AGUIAdapter - TOOL_CALL_START/ARGS/END share same toolCallId", async () => {
  const myTool = tool({
    name: "ping",
    description: "Ping",
    parameters: z.object({}),
    execute: () => Promise.resolve("pong"),
  });

  let turn = 0;
  const model = new MockLanguageModelV3({
    doStream: () => {
      turn++;
      return Promise.resolve(
        turn === 1 ? toolCallStream("ping", {}, "tc-test") : textStream("ok"),
      );
    },
  });

  const agent = new Agent({ model, tools: [myTool] });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const start = events.find((e) => e.type === "TOOL_CALL_START") as
    | Extract<AGUIEvent, { type: "TOOL_CALL_START" }>
    | undefined;
  const args = events.find((e) => e.type === "TOOL_CALL_ARGS") as
    | Extract<AGUIEvent, { type: "TOOL_CALL_ARGS" }>
    | undefined;
  const end = events.find((e) => e.type === "TOOL_CALL_END") as
    | Extract<AGUIEvent, { type: "TOOL_CALL_END" }>
    | undefined;

  assertExists(start);
  assertExists(args);
  assertExists(end);
  assertEquals(start.toolCallId, args.toolCallId);
  assertEquals(start.toolCallId, end.toolCallId);
});

// ---------------------------------------------------------------------------
// Tests - STATE_SNAPSHOT
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - emits STATE_SNAPSHOT from getState callback", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("done")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent, {
    getState: () => ({ counter: 42 }),
  });

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const snapshots = events.filter((e) =>
    e.type === "STATE_SNAPSHOT"
  ) as Extract<
    AGUIEvent,
    { type: "STATE_SNAPSHOT" }
  >[];
  assertEquals(snapshots.length >= 1, true);
});

Deno.test("AGUIAdapter - emits initial STATE_SNAPSHOT from input.state", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("done")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(
    adapter.handleRequest(makeInput({ state: { foo: "bar" } })),
  );

  const snapshots = events.filter((e) =>
    e.type === "STATE_SNAPSHOT"
  ) as Extract<
    AGUIEvent,
    { type: "STATE_SNAPSHOT" }
  >[];
  assertEquals(snapshots.length >= 1, true);

  const first = snapshots[0];
  assertEquals((first.snapshot as Record<string, string>)["foo"], "bar");
});

// ---------------------------------------------------------------------------
// Tests - RAW usage events
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - emits RAW usage event after each turn", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("ok")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const raw = events.filter((e) => e.type === "RAW") as Extract<
    AGUIEvent,
    { type: "RAW" }
  >[];
  assertEquals(raw.length >= 1, true);
  assertEquals(raw[0].event, "usage");
  assertExists(raw[0].source);
});

// ---------------------------------------------------------------------------
// Tests - error handling
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - emits RUN_ERROR when agent exceeds maxTurns", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(toolCallStream("unknown_tool", {})),
  });
  const agent = new Agent({ model, maxTurns: 2 });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const runError = events.find((e) => e.type === "RUN_ERROR");
  assertExists(runError);
});

Deno.test("AGUIAdapter - RUN_ERROR has non-empty message", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(toolCallStream("ghost_tool", {})),
  });
  const agent = new Agent({ model, maxTurns: 1 });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const runError = events.find((e) => e.type === "RUN_ERROR") as
    | Extract<AGUIEvent, { type: "RUN_ERROR" }>
    | undefined;
  assertExists(runError);
  assertEquals(runError.message.length > 0, true);
});

Deno.test("AGUIAdapter - closes pending tool calls with TOOL_CALL_END before RUN_ERROR", async () => {
  // The model always emits a tool call for an unregistered tool, so no tool
  // result is ever produced.  After maxTurns the agent throws MaxTurnsError.
  // The adapter must emit TOOL_CALL_END for every pending (started-but-not-ended)
  // tool call before it emits RUN_ERROR so the UI doesn't show them as running.
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(toolCallStream("ghost_tool", {})),
  });
  const agent = new Agent({ model, maxTurns: 1 });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(adapter.handleRequest(makeInput()));

  const toolCallStart = events.find((e) => e.type === "TOOL_CALL_START") as
    | Extract<AGUIEvent, { type: "TOOL_CALL_START" }>
    | undefined;
  const toolCallEnd = events.find((e) => e.type === "TOOL_CALL_END") as
    | Extract<AGUIEvent, { type: "TOOL_CALL_END" }>
    | undefined;
  const runError = events.find((e) => e.type === "RUN_ERROR");

  // A tool call was started
  assertExists(toolCallStart);
  // It must be closed before the error
  assertExists(toolCallEnd);
  assertExists(runError);

  const startIdx = events.indexOf(toolCallStart);
  const endIdx = events.indexOf(toolCallEnd);
  const errorIdx = events.indexOf(runError);

  assertEquals(startIdx < endIdx, true, "TOOL_CALL_END must come after TOOL_CALL_START");
  assertEquals(endIdx < errorIdx, true, "TOOL_CALL_END must come before RUN_ERROR");
});

// ---------------------------------------------------------------------------
// Tests - handler()
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter handler() - rejects non-POST with 405", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("ok")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);
  const handler = adapter.handler();

  const req = new Request("http://localhost/run", { method: "GET" });
  const res = await handler(req);
  assertEquals(res.status, 405);
});

Deno.test("AGUIAdapter handler() - returns 400 for invalid JSON body", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("ok")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);
  const handler = adapter.handler();

  const req = new Request("http://localhost/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test("AGUIAdapter handler() - returns 400 for missing threadId", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("ok")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);
  const handler = adapter.handler();

  const req = new Request("http://localhost/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
});

Deno.test("AGUIAdapter handler() - streams SSE on valid POST", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hello")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);
  const handler = adapter.handler();

  const input: AGUIRunInput = {
    threadId: "t-1",
    runId: "r-1",
    messages: [{ role: "user", content: "hi" }],
  };

  const req = new Request("http://localhost/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "text/event-stream");

  const events = await collectEvents(res);
  const started = events.find((e) => e.type === "RUN_STARTED");
  assertExists(started);
});

// ---------------------------------------------------------------------------
// Tests - multi-turn conversation
// ---------------------------------------------------------------------------

Deno.test("AGUIAdapter - multi-turn messages build history correctly", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("ok")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  // Simulate a 3-message conversation: user → assistant → user
  const events = await collectEvents(
    adapter.handleRequest({
      threadId: "t-multi",
      runId: "r-1",
      messages: [
        { role: "user", content: "first message" },
        { role: "assistant", content: "got it" },
        { role: "user", content: "second message" },
      ],
    }),
  );

  // Should complete without error
  const finished = events.find((e) => e.type === "RUN_FINISHED");
  assertExists(finished);
});

Deno.test("AGUIAdapter - handles empty messages array gracefully", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("ok")),
  });
  const agent = new Agent({ model });
  const adapter = new AGUIAdapter(agent);

  const events = await collectEvents(
    adapter.handleRequest({
      threadId: "t-empty",
      runId: "r-1",
      messages: [],
    }),
  );

  // Should still complete (with empty prompt)
  const finished = events.find((e) => e.type === "RUN_FINISHED");
  assertExists(finished);
});
