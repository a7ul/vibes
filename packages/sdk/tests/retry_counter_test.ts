/**
 * Tests ported from pydantic-ai v1.80.0 bug fixes:
 * - #4940: unknown tool calls no longer exhaust global retry counter
 * - #4956: output validators see global retry counter on tool output path
 *
 * In vibes, these bugs don't exist due to architectural differences
 * (AI SDK handles tool validation, RunContext is mutable), but we add
 * regression tests to ensure the behavior stays correct.
 */

import { assertEquals } from "@std/assert";
import {
  Agent,
  outputTool,
  type ResultValidator,
  type RunContext,
} from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  textStream,
  toolCallResponse,
  toolCallStream,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Bug fix #4940: unknown tool calls should NOT exhaust the global retry counter
// ---------------------------------------------------------------------------

Deno.test("unknown tool call does not increment retryCount (run)", async () => {
  // Turn 1: model calls an unknown tool name that isn't registered.
  // Because the AI SDK won't execute it, there's no toolResult entry,
  // but toolCalls.length > 0 so the loop continues without nudging.
  // Turn 2: model returns valid text.
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("nonexistent_tool", { foo: "bar" }),
    textResponse("final answer"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, maxRetries: 1 });
  const result = await agent.run("test");

  assertEquals(result.output, "final answer");
  // retryCount should be 0 - unknown tool call did NOT consume a retry
  assertEquals(result.retryCount, 0);
  assertEquals(result.usage.requests, 2);
});

Deno.test("unknown tool call does not increment retryCount (stream)", async () => {
  let turn = 0;
  const model = new MockLanguageModelV3({
    doStream: () => {
      turn++;
      return Promise.resolve(
        turn === 1
          ? toolCallStream("nonexistent_tool", { foo: "bar" })
          : textStream("final answer"),
      );
    },
  });

  const agent = new Agent({ model, maxRetries: 1 });
  const stream = agent.stream("test");

  let collected = "";
  for await (const chunk of stream.textStream) collected += chunk;

  assertEquals(collected, "final answer");
  assertEquals(turn, 2);
});

Deno.test("unknown tool call followed by valid final_result keeps retryCount at 0", async () => {
  const OutputSchema = z.object({ answer: z.string() });

  const responses = mockValues<DoGenerateResult>(
    // Turn 1: unknown tool
    toolCallResponse("hallucinated_tool", { x: 1 }),
    // Turn 2: correct final_result
    toolCallResponse("final_result", { answer: "42" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
    maxRetries: 1,
  });

  const result = await agent.run("what is the answer?");
  assertEquals(result.output.answer, "42");
  assertEquals(result.retryCount, 0);
});

// ---------------------------------------------------------------------------
// Bug fix #4956: output validators see global retry counter on tool output path
// ---------------------------------------------------------------------------

Deno.test("result validator sees current retryCount via RunContext", async () => {
  const OutputSchema = z.object({ value: z.number() });
  type Output = z.infer<typeof OutputSchema>;

  const retryCountsSeen: number[] = [];

  const responses = mockValues<DoGenerateResult>(
    // Turn 1: invalid value → validator rejects → retryCount becomes 1
    toolCallResponse("final_result", { value: -1 }, "tc1"),
    // Turn 2: valid value → validator accepts → retryCount is still 1
    toolCallResponse("final_result", { value: 10 }, "tc2"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent<undefined, Output>({
    model,
    outputSchema: OutputSchema,
    maxRetries: 3,
    resultValidators: [
      (ctx: RunContext<undefined>, output: Output): Output => {
        // Record the retryCount the validator sees
        retryCountsSeen.push(ctx.retryCount);
        if (output.value < 0) throw new Error("Value must be non-negative");
        return output;
      },
    ],
  });

  const result = await agent.run("give me a number");
  assertEquals(result.output.value, 10);
  // First call: retryCount = 0 (no retries yet), validator rejects → increments to 1
  // Second call: retryCount = 1 (after one retry)
  assertEquals(retryCountsSeen, [0, 1]);
  assertEquals(result.retryCount, 1);
});

Deno.test("output tool validator sees current retryCount", async () => {
  const doneTool = outputTool({
    name: "done",
    description: "Return result",
    parameters: z.object({ value: z.number() }),
    execute: (_ctx, args) =>
      Promise.resolve({ value: args.value } as Record<string, unknown>),
  });

  const retryCountsSeen: number[] = [];

  const failingValidator: ResultValidator<
    undefined,
    Record<string, unknown>
  > = (
    ctx,
    output,
  ) => {
    retryCountsSeen.push(ctx.retryCount);
    if ((output as { value: number }).value < 0) throw new Error("negative");
    return output;
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("done", { value: -1 }),
    toolCallResponse("done", { value: 42 }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({
    model,
    tools: [doneTool],
    resultValidators: [failingValidator],
    maxRetries: 3,
  });

  const result = await agent.run("get value");
  assertEquals((result.output as { value: number }).value, 42);
  assertEquals(retryCountsSeen, [0, 1]);
});

Deno.test("streaming result validator sees current retryCount", async () => {
  const OutputSchema = z.object({ value: z.number() });
  type Output = z.infer<typeof OutputSchema>;

  const retryCountsSeen: number[] = [];
  let turn = 0;

  const model = new MockLanguageModelV3({
    doStream: () => {
      turn++;
      return Promise.resolve(
        turn === 1
          ? toolCallStream("final_result", { value: -1 }, "tc1")
          : toolCallStream("final_result", { value: 10 }, "tc2"),
      );
    },
  });

  const agent = new Agent<undefined, Output>({
    model,
    outputSchema: OutputSchema,
    maxRetries: 3,
    resultValidators: [
      (ctx: RunContext<undefined>, output: Output): Output => {
        retryCountsSeen.push(ctx.retryCount);
        if (output.value < 0) throw new Error("Value must be non-negative");
        return output;
      },
    ],
  });

  const stream = agent.stream("give me a number");
  const output = await stream.output;

  assertEquals(output.value, 10);
  assertEquals(retryCountsSeen, [0, 1]);
});
