import { assertEquals } from "@std/assert";
import { Agent, tool } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  textStream,
  toolCallResponse,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("Agent.override - replaces model", async () => {
  const originalModel = new MockLanguageModelV3({
    doGenerate: textResponse("original"),
  });
  const overrideModel = new MockLanguageModelV3({
    doGenerate: textResponse("overridden"),
  });

  const agent = new Agent({ model: originalModel });

  const original = await agent.run("prompt");
  assertEquals(original.output, "original");

  const overridden = await agent.override({ model: overrideModel }).run(
    "prompt",
  );
  assertEquals(overridden.output, "overridden");
});

Deno.test("Agent.override - does not mutate original agent", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("base") });
  const overrideModel = new MockLanguageModelV3({
    doGenerate: textResponse("override"),
  });

  const agent = new Agent({ model });
  await agent.override({ model: overrideModel }).run("x");

  // Original still uses base model
  const r = await agent.run("x");
  assertEquals(r.output, "base");
});

Deno.test("Agent.override - replaces system prompt", async () => {
  let capturedSystem: string | undefined;
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      const sys = opts.prompt.find((m: { role: string }) =>
        m.role === "system"
      );
      capturedSystem = typeof sys?.content === "string"
        ? sys.content
        : undefined;
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({ model, systemPrompt: "original system" });
  await agent.override({ systemPrompt: "overridden system" }).run("hi");
  assertEquals(capturedSystem, "overridden system");
});

Deno.test("Agent.override - replaces tools", async () => {
  let originalCalled = false;
  let overrideCalled = false;

  const originalTool = tool({
    name: "do_thing",
    description: "original",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async () => {
      originalCalled = true;
      return "original";
    },
  });
  const overrideTool = tool({
    name: "do_thing",
    description: "override",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async () => {
      overrideCalled = true;
      return "override";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("do_thing", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [originalTool] });
  await agent.override({ tools: [overrideTool] }).run("use do_thing");

  assertEquals(originalCalled, false);
  assertEquals(overrideCalled, true);
});

Deno.test("Agent.override - overrides maxTurns", async () => {
  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      // Always return a tool call to force more turns
      return Promise.resolve(textResponse("response"));
    },
  });

  const agent = new Agent({ model, maxTurns: 10 });
  // Override to maxTurns: 1 - will return after first text response
  await agent.override({ maxTurns: 1 }).run("prompt");
  assertEquals(callCount, 1);
});

Deno.test("Agent.override - supports stream", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("base") });
  const overrideModel = new MockLanguageModelV3({
    doStream: textStream("streamed override"),
  });

  const agent = new Agent({ model });
  const stream = agent.override({ model: overrideModel }).stream("prompt");

  let collected = "";
  for await (const chunk of stream.textStream) {
    collected += chunk;
  }
  assertEquals(collected, "streamed override");
});
