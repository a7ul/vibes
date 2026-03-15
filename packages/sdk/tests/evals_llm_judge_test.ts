/**
 * evals_llm_judge_test.ts
 *
 * Tests for LLM judge evaluators using FunctionModel to mock LLM responses.
 */
import { assertEquals, assertExists } from "@std/assert";
import { FunctionModel } from "../lib/testing/mod.ts";
import {
  judgeInputOutput,
  judgeInputOutputExpected,
  judgeOutput,
  judgeOutputExpected,
  llmJudge,
  setDefaultJudgeModel,
} from "../lib/evals/llm_judge.ts";
import { EvaluatorContext } from "../lib/evals/context.ts";

function makeCtx(
  output: unknown,
  input: unknown = "test input",
  expectedOutput?: unknown,
): EvaluatorContext {
  return new EvaluatorContext({
    inputs: input,
    output,
    expectedOutput,
    metadata: {},
    spanTree: undefined,
    usage: undefined,
    durationMs: 0,
  });
}

/**
 * Creates a FunctionModel that returns a structured judge response.
 * The model returns tool calls matching the judge output schema.
 */
function makeMockJudgeModel(score: number, reason: string): FunctionModel {
  return new FunctionModel(({ tools }) => {
    // Find the final_result tool
    const finalResultTool = tools.find((t) => t.name === "final_result");
    const toolCallId = "tc-judge-1";
    const toolName = finalResultTool?.name ?? "final_result";

    return Promise.resolve({
      content: [
        {
          type: "tool-call" as const,
          toolCallId,
          toolName,
          input: JSON.stringify({ score, reason }),
        },
      ],
      finishReason: { unified: "tool-calls" as const, raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: 0,
          cacheWrite: undefined,
        },
        outputTokens: { total: 5, text: undefined, reasoning: undefined },
      },
      warnings: [],
    });
  });
}

// ---------------------------------------------------------------------------
// llmJudge
// ---------------------------------------------------------------------------

Deno.test("llmJudge - returns boolean score for assertion mode (score: false)", async () => {
  const model = makeMockJudgeModel(0.9, "looks good");

  const ev = llmJudge({
    rubric: "Is the output helpful?",
    model,
    score: false,
  });

  const ctx = makeCtx("This is a helpful response");
  const result = await ev.evaluate(ctx);

  assertExists(result);
  // When score: false, should return boolean (true if score >= 0.5)
  assertEquals(typeof result.score, "boolean");
  assertEquals(result.score, true);
});

Deno.test("llmJudge - returns numeric score when score: true", async () => {
  const model = makeMockJudgeModel(0.75, "partial credit");

  const ev = llmJudge({
    rubric: "Rate the quality",
    model,
    score: true,
  });

  const ctx = makeCtx("Some output");
  const result = await ev.evaluate(ctx);

  assertExists(result);
  assertEquals(typeof result.score, "number");
  assertEquals(result.score, 0.75);
});

Deno.test("llmJudge - includes reason in result", async () => {
  const model = makeMockJudgeModel(0.8, "good quality");

  const ev = llmJudge({
    rubric: "Check quality",
    model,
  });

  const ctx = makeCtx("output");
  const result = await ev.evaluate(ctx);

  assertExists(result.reason);
  assertEquals(result.reason, "good quality");
});

Deno.test("llmJudge - low score returns false for assertion mode", async () => {
  const model = makeMockJudgeModel(0.2, "poor quality");

  const ev = llmJudge({
    rubric: "Is this good?",
    model,
    score: false,
  });

  const ctx = makeCtx("bad output");
  const result = await ev.evaluate(ctx);

  assertEquals(result.score, false);
});

// ---------------------------------------------------------------------------
// judgeOutput helper
// ---------------------------------------------------------------------------

Deno.test("judgeOutput - calls through and returns score", async () => {
  const model = makeMockJudgeModel(0.9, "good");
  const result = await judgeOutput("my output", "Is it good?", model);
  assertExists(result);
  assertExists(result.reason);
});

// ---------------------------------------------------------------------------
// judgeInputOutput helper
// ---------------------------------------------------------------------------

Deno.test("judgeInputOutput - calls through and returns score", async () => {
  const model = makeMockJudgeModel(0.7, "ok");
  const result = await judgeInputOutput("input", "output", "Is it good?", model);
  assertExists(result);
  assertEquals(typeof result.score, "boolean");
});

// ---------------------------------------------------------------------------
// judgeOutputExpected helper
// ---------------------------------------------------------------------------

Deno.test("judgeOutputExpected - calls through and returns score", async () => {
  const model = makeMockJudgeModel(0.85, "close match");
  const result = await judgeOutputExpected("output", "expected", "Does it match?", model);
  assertExists(result);
  assertExists(result.reason);
});

// ---------------------------------------------------------------------------
// judgeInputOutputExpected helper
// ---------------------------------------------------------------------------

Deno.test("judgeInputOutputExpected - calls through and returns score", async () => {
  const model = makeMockJudgeModel(0.6, "partial");
  const result = await judgeInputOutputExpected("input", "output", "expected", "Does it match?", model);
  assertExists(result);
});

// ---------------------------------------------------------------------------
// setDefaultJudgeModel
// ---------------------------------------------------------------------------

Deno.test("setDefaultJudgeModel - changes default model for judgeOutput", async () => {
  const model = makeMockJudgeModel(0.95, "excellent");
  setDefaultJudgeModel(model);

  // judgeOutput without explicit model should use the default
  const result = await judgeOutput("test output", "Is it good?");
  assertExists(result);
  assertEquals(typeof result.score, "boolean");

  // Reset to undefined to avoid polluting other tests
  setDefaultJudgeModel(undefined as unknown as ReturnType<typeof makeMockJudgeModel>);
});

// ---------------------------------------------------------------------------
// llmJudge with includeInput
// ---------------------------------------------------------------------------

Deno.test("llmJudge with includeInput - evaluates output in context of input", async () => {
  const model = makeMockJudgeModel(0.8, "good given input");

  const ev = llmJudge({
    rubric: "Does the output answer the question?",
    model,
    includeInput: true,
  });

  const ctx = makeCtx("Paris", "What is the capital of France?");
  const result = await ev.evaluate(ctx);

  assertExists(result);
  assertEquals(typeof result.score, "boolean");
});

// ---------------------------------------------------------------------------
// llmJudge with includeExpectedOutput
// ---------------------------------------------------------------------------

Deno.test("llmJudge with includeExpectedOutput - compares to expected", async () => {
  const model = makeMockJudgeModel(0.9, "matches expected");

  const ev = llmJudge({
    rubric: "Does the output match the expected?",
    model,
    includeExpectedOutput: true,
  });

  const ctx = makeCtx("Paris", "capital?", "Paris");
  const result = await ev.evaluate(ctx);

  assertExists(result);
});
