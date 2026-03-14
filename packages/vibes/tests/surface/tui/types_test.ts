import { assertEquals } from "@std/assert";
import type {
  TurnItem,
  ConversationEntry,
  AgentSessionState,
  TuiConfig,
} from "../../../src/surface/tui/types.ts";

Deno.test("TurnItem - text kind has content", () => {
  const item: TurnItem = { kind: "text", content: "hello" };
  assertEquals(item.kind, "text");
  assertEquals(item.content, "hello");
});

Deno.test("TurnItem - tool-call running state", () => {
  const item: TurnItem = {
    kind: "tool-call",
    toolName: "bash",
    toolCallId: "tc1",
    args: { command: "echo hi" },
    status: "running",
  };
  assertEquals(item.kind, "tool-call");
  assertEquals(item.status, "running");
  assertEquals(item.toolName, "bash");
});

Deno.test("TurnItem - tool-call done state with result", () => {
  const item: TurnItem = {
    kind: "tool-call",
    toolName: "read_file",
    toolCallId: "tc2",
    args: { path: "/tmp/foo.ts" },
    result: "file content",
    status: "done",
  };
  assertEquals(item.status, "done");
  assertEquals(item.result, "file content");
});

Deno.test("ConversationEntry - user kind", () => {
  const entry: ConversationEntry = { kind: "user", id: "1", content: "hello" };
  assertEquals(entry.kind, "user");
  assertEquals(entry.content, "hello");
});

Deno.test("ConversationEntry - assistant kind streaming", () => {
  const entry: ConversationEntry = {
    kind: "assistant",
    id: "2",
    items: [],
    status: "streaming",
  };
  assertEquals(entry.kind, "assistant");
  assertEquals(entry.status, "streaming");
  assertEquals(entry.items.length, 0);
});

Deno.test("ConversationEntry - assistant kind complete", () => {
  const entry: ConversationEntry = {
    kind: "assistant",
    id: "3",
    items: [{ kind: "text", content: "done" }],
    status: "complete",
  };
  assertEquals(entry.status, "complete");
  assertEquals(entry.items.length, 1);
});

Deno.test("AgentSessionState - all states are representable", () => {
  const states: AgentSessionState[] = ["idle", "streaming", "error"];
  assertEquals(states.length, 3);
});

Deno.test("TuiConfig - shape is correct", () => {
  const config: TuiConfig = {
    workflowId: "test-wf",
    contextDir: "/tmp",
  };
  assertEquals(config.workflowId, "test-wf");
  assertEquals(config.contextDir, "/tmp");
});
