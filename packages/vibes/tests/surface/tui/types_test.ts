import { assertEquals } from "@std/assert";
import type { TuiMessage, AgentState, TuiConfig, AgentStateSnapshot } from "../../../src/surface/tui/types.ts";

Deno.test("TuiMessage - role values are user or assistant", () => {
  const userMsg: TuiMessage = {
    id: "1",
    role: "user",
    content: "hello",
    timestamp: new Date(),
  };
  const assistantMsg: TuiMessage = {
    id: "2",
    role: "assistant",
    content: "hi",
    timestamp: new Date(),
  };
  assertEquals(userMsg.role, "user");
  assertEquals(assistantMsg.role, "assistant");
});

Deno.test("AgentState - all states are representable", () => {
  const states: AgentState[] = ["idle", "streaming", "complete", "error"];
  assertEquals(states.length, 4);
});

Deno.test("TuiConfig - shape is correct", () => {
  const config: TuiConfig = {
    workflowId: "test-wf",
    contextDir: "/tmp",
  };
  assertEquals(config.workflowId, "test-wf");
  assertEquals(config.contextDir, "/tmp");
});

Deno.test("AgentStateSnapshot - null usage and error on initial state", () => {
  const snapshot: AgentStateSnapshot = {
    state: "idle",
    streamedText: "",
    usage: null,
    error: null,
  };
  assertEquals(snapshot.state, "idle");
  assertEquals(snapshot.usage, null);
  assertEquals(snapshot.error, null);
});
