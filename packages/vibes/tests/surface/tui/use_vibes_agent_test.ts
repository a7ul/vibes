import { assertEquals } from "@std/assert";
import {
  appendTextDelta,
  appendToolCall,
  updateToolCallResult,
  markAssistantStatus,
  formatError,
} from "../../../src/surface/tui/hooks/use_vibes_agent.ts";
import type { ConversationEntry } from "../../../src/surface/tui/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssistant(id: string, items: ConversationEntry["kind"] extends "assistant" ? never : []): ConversationEntry;
function makeAssistant(id: string, items?: ConversationEntry[]): never;
function makeAssistant(id: string): ConversationEntry {
  return { kind: "assistant", id, items: [], status: "streaming" };
}

function makeEntries(...args: ConversationEntry[]): ConversationEntry[] {
  return args;
}

// ---------------------------------------------------------------------------
// appendTextDelta
// ---------------------------------------------------------------------------

Deno.test("appendTextDelta - creates new text item when items is empty", () => {
  const entries: ConversationEntry[] = [makeAssistant("a1")];
  const result = appendTextDelta(entries, "a1", "hello");
  const assistant = result[0];
  assertEquals(assistant.kind, "assistant");
  if (assistant.kind !== "assistant") return;
  assertEquals(assistant.items.length, 1);
  assertEquals(assistant.items[0].kind, "text");
  if (assistant.items[0].kind !== "text") return;
  assertEquals(assistant.items[0].content, "hello");
});

Deno.test("appendTextDelta - appends to existing text item", () => {
  const entries: ConversationEntry[] = [
    {
      kind: "assistant",
      id: "a1",
      items: [{ kind: "text", content: "hel" }],
      status: "streaming",
    },
  ];
  const result = appendTextDelta(entries, "a1", "lo");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error("not assistant");
  assertEquals(assistant.items.length, 1);
  const item = assistant.items[0];
  if (item.kind !== "text") throw new Error("not text");
  assertEquals(item.content, "hello");
});

Deno.test("appendTextDelta - creates new text item after tool-call item", () => {
  const entries: ConversationEntry[] = [
    {
      kind: "assistant",
      id: "a1",
      items: [{ kind: "tool-call", toolName: "bash", toolCallId: "tc1", args: {}, status: "done" }],
      status: "streaming",
    },
  ];
  const result = appendTextDelta(entries, "a1", "output");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error("not assistant");
  assertEquals(assistant.items.length, 2);
  const lastItem = assistant.items[1];
  if (lastItem.kind !== "text") throw new Error("not text");
  assertEquals(lastItem.content, "output");
});

Deno.test("appendTextDelta - does not mutate other entries", () => {
  const userEntry: ConversationEntry = { kind: "user", id: "u1", content: "hi" };
  const assistantEntry: ConversationEntry = makeAssistant("a1");
  const entries = [userEntry, assistantEntry];
  const result = appendTextDelta(entries, "a1", "test");
  assertEquals(result[0], userEntry);
  assertEquals(result.length, 2);
});

Deno.test("appendTextDelta - skips entries with different id", () => {
  const entries: ConversationEntry[] = [makeAssistant("a1"), makeAssistant("a2")];
  const result = appendTextDelta(entries, "a2", "only this one");
  const a1 = result[0];
  const a2 = result[1];
  if (a1.kind !== "assistant" || a2.kind !== "assistant") throw new Error();
  assertEquals(a1.items.length, 0);
  assertEquals(a2.items.length, 1);
});

Deno.test("appendTextDelta - is immutable (original unchanged)", () => {
  const original = makeAssistant("a1");
  const entries = [original];
  appendTextDelta(entries, "a1", "hello");
  assertEquals((original as Extract<ConversationEntry, { kind: "assistant" }>).items.length, 0);
});

// ---------------------------------------------------------------------------
// appendToolCall
// ---------------------------------------------------------------------------

Deno.test("appendToolCall - adds tool-call item to assistant entry", () => {
  const entries: ConversationEntry[] = [makeAssistant("a1")];
  const result = appendToolCall(entries, "a1", {
    kind: "tool-call",
    toolName: "bash",
    toolCallId: "tc1",
    args: { command: "ls" },
    status: "running",
  });
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error();
  assertEquals(assistant.items.length, 1);
  const item = assistant.items[0];
  if (item.kind !== "tool-call") throw new Error();
  assertEquals(item.toolName, "bash");
  assertEquals(item.status, "running");
});

Deno.test("appendToolCall - is immutable", () => {
  const original = makeAssistant("a1");
  const entries = [original];
  appendToolCall(entries, "a1", {
    kind: "tool-call",
    toolName: "bash",
    toolCallId: "tc1",
    args: {},
    status: "running",
  });
  assertEquals((original as Extract<ConversationEntry, { kind: "assistant" }>).items.length, 0);
});

// ---------------------------------------------------------------------------
// updateToolCallResult
// ---------------------------------------------------------------------------

Deno.test("updateToolCallResult - updates matching tool call to done", () => {
  const entries: ConversationEntry[] = [
    {
      kind: "assistant",
      id: "a1",
      items: [{ kind: "tool-call", toolName: "bash", toolCallId: "tc1", args: {}, status: "running" }],
      status: "streaming",
    },
  ];
  const result = updateToolCallResult(entries, "a1", "tc1", "hello world\n");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error();
  const item = assistant.items[0];
  if (item.kind !== "tool-call") throw new Error();
  assertEquals(item.status, "done");
  assertEquals(item.result, "hello world\n");
});

Deno.test("updateToolCallResult - does not mutate other tool calls", () => {
  const entries: ConversationEntry[] = [
    {
      kind: "assistant",
      id: "a1",
      items: [
        { kind: "tool-call", toolName: "bash", toolCallId: "tc1", args: {}, status: "running" },
        { kind: "tool-call", toolName: "read", toolCallId: "tc2", args: {}, status: "running" },
      ],
      status: "streaming",
    },
  ];
  const result = updateToolCallResult(entries, "a1", "tc1", "result");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error();
  const tc2 = assistant.items[1];
  if (tc2.kind !== "tool-call") throw new Error();
  assertEquals(tc2.status, "running");
});

// ---------------------------------------------------------------------------
// markAssistantStatus
// ---------------------------------------------------------------------------

Deno.test("markAssistantStatus - marks assistant as complete", () => {
  const entries: ConversationEntry[] = [makeAssistant("a1")];
  const result = markAssistantStatus(entries, "a1", "complete");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error();
  assertEquals(assistant.status, "complete");
});

Deno.test("markAssistantStatus - marks assistant as error", () => {
  const entries: ConversationEntry[] = [makeAssistant("a1")];
  const result = markAssistantStatus(entries, "a1", "error");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error();
  assertEquals(assistant.status, "error");
});

Deno.test("markAssistantStatus - stores errorMessage when provided", () => {
  const entries: ConversationEntry[] = [makeAssistant("a1")];
  const result = markAssistantStatus(entries, "a1", "error", "something went wrong");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error();
  assertEquals(assistant.status, "error");
  assertEquals(assistant.errorMessage, "something went wrong");
});

Deno.test("markAssistantStatus - errorMessage is undefined when not provided", () => {
  const entries: ConversationEntry[] = [makeAssistant("a1")];
  const result = markAssistantStatus(entries, "a1", "complete");
  const assistant = result[0];
  if (assistant.kind !== "assistant") throw new Error();
  assertEquals(assistant.errorMessage, undefined);
});

Deno.test("markAssistantStatus - does not affect other entries", () => {
  const entries: ConversationEntry[] = [
    makeAssistant("a1"),
    makeAssistant("a2"),
  ];
  const result = markAssistantStatus(entries, "a1", "complete");
  const a2 = result[1];
  if (a2.kind !== "assistant") throw new Error();
  assertEquals(a2.status, "streaming");
});

// ---------------------------------------------------------------------------
// formatError
// ---------------------------------------------------------------------------

Deno.test("formatError - handles generic Error", () => {
  assertEquals(formatError(new Error("something broke")), "something broke");
});

Deno.test("formatError - handles MaxTurnsError", () => {
  const err = new Error("50 turns");
  err.name = "MaxTurnsError";
  assertEquals(formatError(err), "Max turns reached: 50 turns");
});

Deno.test("formatError - handles MaxRetriesError", () => {
  const err = new Error("3 retries");
  err.name = "MaxRetriesError";
  assertEquals(formatError(err), "Max retries reached: 3 retries");
});

Deno.test("formatError - handles non-Error values", () => {
  assertEquals(formatError("string error"), "string error");
  assertEquals(formatError(42), "42");
});

// ---------------------------------------------------------------------------
// State machine logic
// ---------------------------------------------------------------------------

Deno.test("state machine - idle->streaming->idle transition", () => {
  type S = "idle" | "streaming" | "error";

  function transition(state: S, event: "start" | "done" | "fail"): S {
    if (event === "start" && state === "idle") return "streaming";
    if (event === "done" && state === "streaming") return "idle";
    if (event === "fail" && state === "streaming") return "error";
    return state;
  }

  assertEquals(transition("idle", "start"), "streaming");
  assertEquals(transition("streaming", "done"), "idle");
  assertEquals(transition("streaming", "fail"), "error");
  assertEquals(transition("idle", "done"), "idle");
});

Deno.test("state machine - cannot send when streaming", () => {
  type S = "idle" | "streaming" | "error";
  const canSend = (s: S) => s !== "streaming";
  assertEquals(canSend("idle"), true);
  assertEquals(canSend("streaming"), false);
  assertEquals(canSend("error"), true);
});
