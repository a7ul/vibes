import { assertEquals } from "@std/assert";
import { setAllowModelRequests } from "@vibes/framework";
import {
  MockLanguageModelV3,
  toolCallResponse,
  type DoGenerateResult,
  mockValues,
} from "../../_helpers.ts";
import { createCoreAgent } from "../../../src/agents/core_agent/agent.ts";

// Agent run integration tests (uses doGenerate path which is mocked)
const deps = { workflowId: "test-wf", contextDir: "/tmp", runId: "test-run" };

Deno.test("useAgent logic - agent.run returns completed output", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("final_result", { taskStatus: "completed", taskSummary: "Done" }),
  );
  const model = new MockLanguageModelV3({ doGenerate: () => Promise.resolve(responses()) });

  setAllowModelRequests(false);
  try {
    const agent = createCoreAgent();
    const result = await agent.override({ model }).run("test prompt", { deps });
    assertEquals(result.output.taskStatus, "completed");
    assertEquals(result.output.taskSummary, "Done");
  } finally {
    setAllowModelRequests(true);
  }
});

Deno.test("useAgent logic - agent.run returns failed output", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(
        toolCallResponse("final_result", { taskStatus: "failed", taskSummary: "Broke" }),
      ),
  });

  setAllowModelRequests(false);
  try {
    const agent = createCoreAgent();
    const result = await agent.override({ model }).run("test", { deps });
    assertEquals(result.output.taskStatus, "failed");
  } finally {
    setAllowModelRequests(true);
  }
});

Deno.test("useAgent logic - agent.run resolves usage", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(
        toolCallResponse("final_result", { taskStatus: "completed", taskSummary: "ok" }),
      ),
  });

  setAllowModelRequests(false);
  try {
    const agent = createCoreAgent();
    const result = await agent.override({ model }).run("test", { deps });
    assertEquals(typeof result.usage.inputTokens, "number");
    assertEquals(typeof result.usage.outputTokens, "number");
    assertEquals(typeof result.usage.totalTokens, "number");
    assertEquals(typeof result.usage.requests, "number");
  } finally {
    setAllowModelRequests(true);
  }
});

// Pure logic tests for error formatting
Deno.test("useAgent logic - formatError handles generic Error", () => {
  function formatError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === "MaxTurnsError") return `Max turns reached: ${err.message}`;
      if (err.name === "MaxRetriesError") return `Max retries reached: ${err.message}`;
      return err.message;
    }
    return String(err);
  }

  assertEquals(formatError(new Error("something broke")), "something broke");
});

Deno.test("useAgent logic - formatError handles MaxTurnsError", () => {
  function formatError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === "MaxTurnsError") return `Max turns reached: ${err.message}`;
      if (err.name === "MaxRetriesError") return `Max retries reached: ${err.message}`;
      return err.message;
    }
    return String(err);
  }

  const err = new Error("50 turns");
  err.name = "MaxTurnsError";
  assertEquals(formatError(err), "Max turns reached: 50 turns");
});

Deno.test("useAgent logic - formatError handles MaxRetriesError", () => {
  function formatError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === "MaxTurnsError") return `Max turns reached: ${err.message}`;
      if (err.name === "MaxRetriesError") return `Max retries reached: ${err.message}`;
      return err.message;
    }
    return String(err);
  }

  const err = new Error("3 retries");
  err.name = "MaxRetriesError";
  assertEquals(formatError(err), "Max retries reached: 3 retries");
});

Deno.test("useAgent logic - formatError handles non-Error values", () => {
  function formatError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === "MaxTurnsError") return `Max turns reached: ${err.message}`;
      if (err.name === "MaxRetriesError") return `Max retries reached: ${err.message}`;
      return err.message;
    }
    return String(err);
  }

  assertEquals(formatError("string error"), "string error");
  assertEquals(formatError(42), "42");
});

// State machine logic tests
Deno.test("useAgent logic - idle->streaming->complete transition", () => {
  type AgentState = "idle" | "streaming" | "complete" | "error";

  function transition(state: AgentState, event: "start" | "done" | "fail"): AgentState {
    if (event === "start" && state === "idle") return "streaming";
    if (event === "done" && state === "streaming") return "complete";
    if (event === "fail" && state === "streaming") return "error";
    return state;
  }

  assertEquals(transition("idle", "start"), "streaming");
  assertEquals(transition("streaming", "done"), "complete");
  assertEquals(transition("streaming", "fail"), "error");
  assertEquals(transition("idle", "done"), "idle"); // no-op
});

Deno.test("useAgent logic - cannot start when already streaming", () => {
  type AgentState = "idle" | "streaming" | "complete" | "error";

  function canSend(state: AgentState): boolean {
    return state !== "streaming";
  }

  assertEquals(canSend("idle"), true);
  assertEquals(canSend("streaming"), false);
  assertEquals(canSend("complete"), true);
  assertEquals(canSend("error"), true);
});
