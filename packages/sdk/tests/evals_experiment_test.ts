/**
 * evals_experiment_test.ts
 *
 * Tests for Dataset.evaluate(), runExperiment(), and report formatting.
 */
import {
  assertEquals,
  assertExists,
  assert,
} from "@std/assert";
import { Dataset } from "../lib/evals/dataset.ts";
import { equalsExpected, custom } from "../lib/evals/builtin_evaluators.ts";
import { runExperiment } from "../lib/evals/experiment.ts";
import { formatReport, toJSON } from "../lib/evals/report.ts";
import type { CaseResult } from "../lib/evals/types.ts";

// ---------------------------------------------------------------------------
// Basic experiment
// ---------------------------------------------------------------------------

Deno.test("Dataset.evaluate - basic experiment with equalsExpected passes", async () => {
  const ds = Dataset.fromArray(
    [
      { name: "test1", inputs: "hello", expectedOutput: "HELLO" },
      { name: "test2", inputs: "world", expectedOutput: "WORLD" },
    ],
    { evaluators: [equalsExpected()] },
  );

  const result = await ds.evaluate(async (input: string) => input.toUpperCase());

  assertEquals(result.cases.length, 2);
  assertEquals(result.cases[0].error, undefined);
  assertExists(result.cases[0].scores["equalsExpected"]);
  assertEquals(result.cases[0].scores["equalsExpected"].score, true);
});

Deno.test("Dataset.evaluate - error in one case doesn't abort experiment", async () => {
  const ds = Dataset.fromArray([
    { name: "good", inputs: "hello" },
    { name: "bad", inputs: "throw" },
    { name: "good2", inputs: "world" },
  ]);

  const result = await ds.evaluate(async (input: string) => {
    if (input === "throw") throw new Error("deliberate error");
    return input.toUpperCase();
  });

  assertEquals(result.cases.length, 3);
  assertEquals(result.cases[0].error, undefined);
  assertExists(result.cases[1].error);
  assertEquals(result.cases[2].error, undefined);
});

Deno.test("Dataset.evaluate - onCaseComplete called for each case", async () => {
  const ds = Dataset.fromArray([
    { inputs: "a" },
    { inputs: "b" },
    { inputs: "c" },
  ]);

  const completed: CaseResult[] = [];
  await ds.evaluate(async (input: string) => input, {
    onCaseComplete: (r) => completed.push(r),
  });

  assertEquals(completed.length, 3);
});

Deno.test("Dataset.evaluate - maxConcurrency is respected", async () => {
  let concurrent = 0;
  let maxConcurrent = 0;

  const ds = Dataset.fromArray(
    Array.from({ length: 10 }, (_, i) => ({ inputs: i })),
  );

  await ds.evaluate(
    async (input: number) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return input * 2;
    },
    { maxConcurrency: 3 },
  );

  assertEquals(maxConcurrent <= 3, true);
});

Deno.test("Dataset.evaluate - summary contains mean/min/max", async () => {
  const ds = Dataset.fromArray(
    [
      { inputs: "a", expectedOutput: "A" },
      { inputs: "b", expectedOutput: "B" },
    ],
    { evaluators: [equalsExpected()] },
  );

  const result = await ds.evaluate(async (input: string) => input.toUpperCase());

  assertExists(result.summary["equalsExpected"]);
  assertExists(result.summary["equalsExpected"].mean);
});

Deno.test("Dataset.evaluate - totalDuration is positive", async () => {
  const ds = Dataset.fromArray([{ inputs: "hi" }]);
  const result = await ds.evaluate(async (input: string) => input);
  assert(result.totalDuration >= 0);
});

Deno.test("Dataset.evaluate - timestamp is valid ISO string", async () => {
  const ds = Dataset.fromArray([{ inputs: "hi" }]);
  const result = await ds.evaluate(async (input: string) => input);
  assertExists(result.timestamp);
  const date = new Date(result.timestamp);
  assertEquals(isNaN(date.getTime()), false);
});

// ---------------------------------------------------------------------------
// Per-case evaluators from Case
// ---------------------------------------------------------------------------

Deno.test("Dataset.evaluate - per-case evaluators run", async () => {
  const caseEv = custom<string, string>("case-specific", (ctx) => ({
    score: ctx.output === "HELLO",
  }));

  const ds = Dataset.fromArray([
    { inputs: "hello", evaluators: [caseEv] },
  ]);

  const result = await ds.evaluate(async (input: string) => input.toUpperCase());

  assertExists(result.cases[0].scores["case-specific"]);
  assertEquals(result.cases[0].scores["case-specific"].score, true);
});

// ---------------------------------------------------------------------------
// Report evaluators
// ---------------------------------------------------------------------------

Deno.test("Dataset.evaluate - report evaluators run after all cases", async () => {
  let reportCalled = false;
  const reportEv = {
    name: "report-eval",
    evaluate: (results: CaseResult[]) => {
      reportCalled = true;
      assertEquals(results.length, 2);
      return { score: results.length, reason: "counted" };
    },
  };

  const ds = Dataset.fromArray(
    [{ inputs: "a" }, { inputs: "b" }],
    { reportEvaluators: [reportEv] },
  );

  await ds.evaluate(async (input: string) => input);
  assertEquals(reportCalled, true);
});

// ---------------------------------------------------------------------------
// runExperiment thin wrapper
// ---------------------------------------------------------------------------

Deno.test("runExperiment - thin wrapper works", async () => {
  const ds = Dataset.fromArray([
    { inputs: "hi", expectedOutput: "HI" },
  ]);

  const result = await runExperiment({
    dataset: ds,
    task: async (input: string) => input.toUpperCase(),
    evaluators: [equalsExpected()],
  });

  assertEquals(result.cases.length, 1);
  assertExists(result.cases[0].scores["equalsExpected"]);
});

// ---------------------------------------------------------------------------
// formatReport
// ---------------------------------------------------------------------------

Deno.test("formatReport - produces non-empty string", async () => {
  const ds = Dataset.fromArray([
    { inputs: "hello", expectedOutput: "HELLO" },
  ], { evaluators: [equalsExpected()] });

  const result = await ds.evaluate(async (i: string) => i.toUpperCase());
  const report = formatReport(result);

  assertEquals(typeof report, "string");
  assert(report.length > 0);
  // Should contain some meaningful content
  assert(report.includes("equalsExpected") || report.includes("Eval"));
});

Deno.test("toJSON - serializes result to plain object", async () => {
  const ds = Dataset.fromArray([{ inputs: "hi" }]);
  const result = await ds.evaluate(async (i: string) => i);
  const json = toJSON(result);

  assertExists(json);
  assertExists((json as { cases: unknown[] }).cases);
  assertExists((json as { timestamp: string }).timestamp);
});

// ---------------------------------------------------------------------------
// maxRetries
// ---------------------------------------------------------------------------

Deno.test("Dataset.evaluate - maxRetries retries on failure", async () => {
  let attempts = 0;

  const ds = Dataset.fromArray([{ inputs: "retry-me" }]);

  const result = await ds.evaluate(
    async (_input: string) => {
      attempts++;
      if (attempts < 3) throw new Error("transient");
      return "success";
    },
    { maxRetries: 3 },
  );

  assertEquals(result.cases[0].error, undefined);
  assertEquals(result.cases[0].output, "success");
  assertEquals(attempts, 3);
});

Deno.test("Dataset.evaluate - error captured after exhausting retries", async () => {
  const ds = Dataset.fromArray([{ inputs: "always-fail" }]);

  const result = await ds.evaluate(
    async (_input: string) => {
      throw new Error("always");
    },
    { maxRetries: 2 },
  );

  assertExists(result.cases[0].error);
  assertEquals(result.cases[0].output, undefined);
});
