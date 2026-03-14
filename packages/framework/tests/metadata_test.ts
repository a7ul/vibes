import { assertEquals } from "@std/assert";
import { Agent, type RunContext, tool } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("metadata - accessible on RunContext in tools", async () => {
  let capturedMeta: Record<string, unknown> = {};

  const myTool = tool({
    name: "check_meta",
    description: "Reads metadata",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async (ctx: RunContext) => {
      capturedMeta = ctx.metadata;
      return "ok";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("check_meta", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("use tool", {
    metadata: { requestId: "abc-123", userId: 42 },
  });

  assertEquals(capturedMeta.requestId, "abc-123");
  assertEquals(capturedMeta.userId, 42);
});

Deno.test("metadata - defaults to empty object when not provided", async () => {
  let capturedMeta: Record<string, unknown> | undefined;

  const myTool = tool({
    name: "peek",
    description: "Peek metadata",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async (ctx: RunContext) => {
      capturedMeta = ctx.metadata;
      return "ok";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("peek", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("use tool");

  assertEquals(capturedMeta, {});
});

Deno.test("metadata - accessible in dynamic system prompt", async () => {
  let capturedMeta: Record<string, unknown> = {};
  const model = new MockLanguageModelV3({ doGenerate: textResponse("ok") });

  const agent = new Agent({
    model,
    systemPrompt: (ctx) => {
      capturedMeta = ctx.metadata;
      return "system";
    },
  });

  await agent.run("prompt", { metadata: { env: "test" } });
  assertEquals(capturedMeta.env, "test");
});
