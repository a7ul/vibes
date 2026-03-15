import { assertEquals } from "@std/assert";
import { Agent, outputTool, type ResultValidator, tool } from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  toolCallResponse,
} from "./_helpers.ts";

Deno.test("outputTool - ends run and returns tool result as output", async () => {
  const doneTool = outputTool({
    name: "done",
    description: "Return the final answer",
    parameters: z.object({ answer: z.string() }),
    execute: (_ctx, args) => Promise.resolve(args.answer),
  });

  assertEquals(doneTool.isOutput, true);
  assertEquals(doneTool.name, "done");

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("done", { answer: "42" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [doneTool] });
  const result = await agent.run("What is the answer?");
  assertEquals(result.output, "42");
});

Deno.test("outputTool - returns object result as output", async () => {
  const doneTool = outputTool({
    name: "finalize",
    description: "Finalize with structured data",
    parameters: z.object({ name: z.string(), score: z.number() }),
    execute: (_ctx, args) => Promise.resolve({ name: args.name, score: args.score }),
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("finalize", { name: "Alice", score: 100 }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [doneTool] });
  const result = await agent.run("finalize it");
  const output = result.output as unknown as { name: string; score: number };
  assertEquals(output.name, "Alice");
  assertEquals(output.score, 100);
});

Deno.test("outputTool - output tool result takes precedence over continued looping", async () => {
  let regularToolCalled = false;
  const regularTool = tool({
    name: "regular",
    description: "A regular tool",
    parameters: z.object({}),
    execute: () => {
      regularToolCalled = true;
      return Promise.resolve("regular");
    },
  });

  const doneTool = outputTool({
    name: "done",
    description: "Done",
    parameters: z.object({ value: z.string() }),
    execute: (_ctx, args) => Promise.resolve(args.value),
  });

  // Model calls done tool - the agent should stop without calling regular tool
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("done", { value: "finished" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [regularTool, doneTool] });
  const result = await agent.run("finish");
  assertEquals(result.output, "finished");
  assertEquals(regularToolCalled, false);
});

Deno.test("outputTool - agent with no outputSchema still uses outputTool", async () => {
  // Agent has no outputSchema, but output tool provides the final result
  const doneTool = outputTool({
    name: "submit",
    description: "Submit result",
    parameters: z.object({ result: z.string() }),
    execute: (_ctx, args) => Promise.resolve(args.result),
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("submit", { result: "my answer" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [doneTool] });
  const result = await agent.run("answer the question");
  assertEquals(result.output, "my answer");
});

Deno.test("outputTool - result validator can reject then accept output tool result", async () => {
  const doneTool = outputTool({
    name: "done",
    description: "Done",
    parameters: z.object({ value: z.string() }),
    execute: (_ctx, args) => Promise.resolve(args.value),
  });

  let validatorCallCount = 0;
  const failingValidator: ResultValidator<undefined, string> = (
    _ctx,
    output,
  ) => {
    validatorCallCount++;
    if (validatorCallCount === 1) throw new Error("rejected on first call");
    return output; // Accept on second call
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("done", { value: "first" }),
    // After rejection, agent retries - model provides second done call
    toolCallResponse("done", { value: "second" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({
    model,
    tools: [doneTool],
    resultValidators: [failingValidator],
    maxRetries: 2,
  });

  // First validator call rejects, second accepts - run succeeds with "second"
  const result = await agent.run("get answer");
  assertEquals(result.output, "second");
  assertEquals(validatorCallCount, 2);
});
