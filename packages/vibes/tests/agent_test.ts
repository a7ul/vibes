import { assertEquals, assertExists } from "@std/assert";
import { createCoreAgent } from "../src/agents/core_agent/agent.ts";
import { MAX_RETRIES, MAX_TURNS } from "../src/constants.ts";
import {
  MockLanguageModelV3,
  mockValues,
  toolCallResponse,
  type DoGenerateResult,
} from "./_helpers.ts";
import type { CoreAgentDeps } from "../src/types.ts";
import { setAllowModelRequests } from "@vibesjs/sdk";

const deps: CoreAgentDeps = {
  workflowId: "test-wf",
  contextDir: "/tmp",
  runId: "test-run",
};

Deno.test("createCoreAgent - has correct config", () => {
  const agent = createCoreAgent();
  assertEquals(agent.name, "core-agent");
  assertEquals(agent.maxTurns, MAX_TURNS);
  assertEquals(agent.maxRetries, MAX_RETRIES);
  assertExists(agent.outputSchema);
});

Deno.test("createCoreAgent - has system prompt", () => {
  const agent = createCoreAgent();
  assertEquals(agent.systemPrompts.length > 0, true);
});

Deno.test("createCoreAgent - returns structured output", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("final_result", {
      taskStatus: "completed",
      taskSummary: "All done",
    }),
  );

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  setAllowModelRequests(false);
  try {
    const agent = createCoreAgent();
    const result = await agent.override({ model }).run("Do something.", { deps });

    assertEquals(result.output.taskStatus, "completed");
    assertEquals(result.output.taskSummary, "All done");
  } finally {
    setAllowModelRequests(true);
  }
});

Deno.test("createCoreAgent - uses system prompt with task instructions", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      const sysMsg = opts.prompt.find((m: { role: string }) => m.role === "system");
      capturedSystem = typeof sysMsg?.content === "string" ? sysMsg.content : undefined;
      return Promise.resolve(
        toolCallResponse("final_result", { taskStatus: "completed", taskSummary: "ok" }),
      );
    },
  });

  setAllowModelRequests(false);
  try {
    const agent = createCoreAgent();
    await agent.override({ model }).run("test", { deps });

    assertExists(capturedSystem);
    assertEquals(capturedSystem!.includes("sandbox"), true);
  } finally {
    setAllowModelRequests(true);
  }
});

Deno.test("createCoreAgent - exposes all toolsets", () => {
  const agent = createCoreAgent();
  assertEquals(agent.toolsets.length > 0, true);
});

Deno.test("createCoreAgent - handles failed task status", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(
        toolCallResponse("final_result", {
          taskStatus: "failed",
          taskSummary: "Something went wrong",
        }),
      ),
  });

  setAllowModelRequests(false);
  try {
    const agent = createCoreAgent();
    const result = await agent.override({ model }).run("fail", { deps });
    assertEquals(result.output.taskStatus, "failed");
  } finally {
    setAllowModelRequests(true);
  }
});
