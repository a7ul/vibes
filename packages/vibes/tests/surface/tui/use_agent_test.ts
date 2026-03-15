import { assertEquals } from "@std/assert";
import { setAllowModelRequests } from "@vibesjs/sdk";
import {
  MockLanguageModelV3,
  toolCallResponse,
  type DoGenerateResult,
  mockValues,
} from "../../_helpers.ts";
import { createCoreAgent } from "../../../src/agents/core_agent/agent.ts";

// Agent run integration tests (uses doGenerate path which is mocked)
const deps = { workflowId: "test-wf", contextDir: "/tmp", runId: "test-run" };

Deno.test("agent.run - returns completed output", async () => {
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

Deno.test("agent.run - returns failed output", async () => {
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

Deno.test("agent.run - resolves usage", async () => {
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
