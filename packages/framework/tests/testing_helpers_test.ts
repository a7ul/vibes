import { assertEquals, assertRejects } from "@std/assert";
import {
  Agent,
  captureRunMessages,
  getAllowModelRequests,
  setAllowModelRequests,
} from "../mod.ts";
import { ModelRequestsDisabledError } from "../errors.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// Re-enable model requests after each test in case tests fail mid-way
function withModelRequestsEnabled<T>(fn: () => Promise<T>): Promise<T> {
  setAllowModelRequests(true);
  return fn().finally(() => setAllowModelRequests(true));
}

Deno.test("setAllowModelRequests - default is true", () => {
  assertEquals(getAllowModelRequests(), true);
});

Deno.test("setAllowModelRequests - false blocks runs", async () => {
  await withModelRequestsEnabled(async () => {
    setAllowModelRequests(false);
    const model = new MockLanguageModelV3({ doGenerate: textResponse("ok") });
    const agent = new Agent({ model });
    await assertRejects(
      () => agent.run("prompt"),
      ModelRequestsDisabledError,
    );
  });
});

Deno.test("setAllowModelRequests - false blocks streams", async () => {
  await withModelRequestsEnabled(async () => {
    setAllowModelRequests(false);
    const model = new MockLanguageModelV3({ doGenerate: textResponse("ok") });
    const agent = new Agent({ model });
    // executeStream throws synchronously before returning StreamResult
    await assertRejects(
      // deno-lint-ignore require-await
      async () => {
        agent.stream("prompt");
      },
      ModelRequestsDisabledError,
    );
  });
});

Deno.test("agent.override bypasses ALLOW_MODEL_REQUESTS=false", async () => {
  await withModelRequestsEnabled(async () => {
    setAllowModelRequests(false);
    const mockModel = new MockLanguageModelV3({
      doGenerate: textResponse("bypassed"),
    });
    const realModel = new MockLanguageModelV3({
      doGenerate: textResponse("real"),
    });
    const agent = new Agent({ model: realModel });

    // override() bypasses the guard
    const result = await agent.override({ model: mockModel }).run("prompt");
    assertEquals(result.output, "bypassed");
  });
});

Deno.test("captureRunMessages - captures messages sent to model", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("hi") });
  const agent = new Agent({ model, systemPrompt: "Be helpful." });

  const { result, messages } = await captureRunMessages(() =>
    agent.run("hello")
  );

  assertEquals(result.output, "hi");
  assertEquals(messages.length, 1); // one turn
  assertEquals(messages[0][0].role, "user");
  assertEquals(
    typeof messages[0][0].content === "string"
      ? messages[0][0].content
      : (messages[0][0].content as Array<{ text?: string }>)[0]?.text,
    "hello",
  );
});

Deno.test("captureRunMessages - captures each turn separately", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("echo", {}),
    textResponse("done"),
  );
  const echoTool = {
    name: "echo",
    description: "echo",
    parameters: (await import("zod")).z.object({}),
    // deno-lint-ignore require-await
    execute: async () => "echoed",
  };
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });
  const agent = new Agent({ model, tools: [echoTool] });

  const { messages } = await captureRunMessages(() => agent.run("prompt"));
  // Two model calls: one for the tool call, one for the text response
  assertEquals(messages.length, 2);
  assertEquals(messages[0][0].role, "user"); // turn 1: just the user message
  // turn 2 includes prior messages too
  assertEquals(messages[1].length > 1, true);
});
