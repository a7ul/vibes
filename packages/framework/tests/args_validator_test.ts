import { assertEquals } from "@std/assert";
import { Agent, tool } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("argsValidator - passes valid args through", async () => {
  let validateCalled = false;
  const myTool = tool({
    name: "send_amount",
    description: "Send an amount",
    parameters: z.object({ amount: z.number() }),
    argsValidator: ({ amount }) => {
      validateCalled = true;
      if (amount <= 0) throw new Error("amount must be positive");
    },
    execute: (_ctx, { amount }) => Promise.resolve(`sent ${amount}`),
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("send_amount", { amount: 100 }),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });
  const agent = new Agent({ model, tools: [myTool] });

  await agent.run("send 100");
  assertEquals(validateCalled, true);
});

Deno.test("argsValidator - rejects invalid args before execute", async () => {
  let executeCalled = false;
  const myTool = tool({
    name: "send_amount",
    description: "Send an amount",
    parameters: z.object({ amount: z.number() }),
    argsValidator: ({ amount }) => {
      if (amount <= 0) throw new Error("amount must be positive");
    },
    execute: (_ctx, { amount }) => {
      executeCalled = true;
      return Promise.resolve(`sent ${amount}`);
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("send_amount", { amount: -5 }),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  // argsValidator throws → tool execution propagates error back to AI SDK
  // The agent continues the run but execute is never called
  const agent = new Agent({ model, tools: [myTool] });
  // The run should still complete (AI SDK handles tool errors gracefully)
  try {
    await agent.run("send -5");
  } catch {
    // May throw MaxTurnsError if model keeps retrying — that's fine
  }
  assertEquals(executeCalled, false);
});

Deno.test("argsValidator - async validator is awaited", async () => {
  let asyncValidateCalled = false;
  const myTool = tool({
    name: "check",
    description: "Check a value",
    parameters: z.object({ value: z.string() }),
    argsValidator: async ({ value }) => {
      await Promise.resolve(); // simulate async work
      asyncValidateCalled = true;
      if (value === "bad") throw new Error("bad value");
    },
    execute: (_ctx, { value }) => Promise.resolve(`checked: ${value}`),
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("check", { value: "good" }),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });
  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("check value");
  assertEquals(asyncValidateCalled, true);
});
