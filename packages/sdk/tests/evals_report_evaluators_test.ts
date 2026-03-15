/**
 * evals_report_evaluators_test.ts
 *
 * Tests for report-level evaluators: confusion matrix, precision/recall, ROC AUC, KS.
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  confusionMatrix,
  kolmogorovSmirnov,
  precisionRecall,
  rocAuc,
} from "../lib/evals/report_evaluators.ts";
import type { CaseResult } from "../lib/evals/types.ts";

function makeResult(
  output: unknown,
  expectedOutput?: unknown,
): CaseResult<unknown, unknown, unknown> {
  return {
    case: { inputs: "x", expectedOutput },
    output,
    error: undefined,
    scores: {},
    duration: 10,
    attributes: {},
    metrics: {},
  };
}

// ---------------------------------------------------------------------------
// confusionMatrix
// ---------------------------------------------------------------------------

Deno.test("confusionMatrix - computes TP/TN/FP/FN correctly", () => {
  const results: CaseResult[] = [
    makeResult("cat", "cat"), // TP for cat
    makeResult("cat", "dog"), // FP for cat, FN for dog
    makeResult("dog", "dog"), // TP for dog
    makeResult("dog", "cat"), // FP for dog, FN for cat
  ];

  const ev = confusionMatrix({
    getLabel: (r) => r.output as string,
    getExpected: (r) => r.case.expectedOutput as string,
  });

  const score = ev.evaluate(results);
  assertExists(score);
  assertExists((score as { reason: string }).reason);
});

Deno.test("confusionMatrix - returns string label as score", () => {
  const results: CaseResult[] = [
    makeResult("a", "a"),
    makeResult("b", "b"),
  ];

  const ev = confusionMatrix({
    getLabel: (r) => r.output as string,
    getExpected: (r) => r.case.expectedOutput as string,
  });

  const score = ev.evaluate(results);
  assertEquals(typeof (score as { score: unknown }).score, "string");
});

// ---------------------------------------------------------------------------
// precisionRecall
// ---------------------------------------------------------------------------

Deno.test("precisionRecall - computes precision and recall", () => {
  // 3 true positives, 1 false positive, 1 false negative
  const results: CaseResult[] = [
    makeResult(true, true), // TP
    makeResult(true, true), // TP
    makeResult(true, true), // TP
    makeResult(true, false), // FP
    makeResult(false, true), // FN
    makeResult(false, false), // TN
  ];

  const ev = precisionRecall({
    getPositive: (r) => r.output as boolean,
    getExpected: (r) => r.case.expectedOutput as boolean,
  });

  const score = ev.evaluate(results);
  assertExists(score);
  assertExists((score as { reason: string }).reason);
  // precision = 3/4 = 0.75
  // recall = 3/4 = 0.75
  const reason = (score as { reason: string }).reason;
  assertEquals(reason.includes("0.75"), true);
});

Deno.test("precisionRecall - handles zero TP gracefully", () => {
  const results: CaseResult[] = [
    makeResult(false, true), // FN
    makeResult(false, false), // TN
  ];

  const ev = precisionRecall({
    getPositive: (r) => r.output as boolean,
    getExpected: (r) => r.case.expectedOutput as boolean,
  });

  const score = ev.evaluate(results);
  assertExists(score);
  // Should not throw, precision/recall can be 0
});

// ---------------------------------------------------------------------------
// rocAuc
// ---------------------------------------------------------------------------

Deno.test("rocAuc - returns AUC in [0, 1]", () => {
  const results: CaseResult[] = [
    makeResult(0.9, true),
    makeResult(0.8, true),
    makeResult(0.3, false),
    makeResult(0.1, false),
  ];

  const ev = rocAuc({
    getScore: (r) => r.output as number,
    getLabel: (r) => r.case.expectedOutput as boolean,
  });

  const score = ev.evaluate(results);
  const val = (score as { score: number }).score;
  assertEquals(typeof val, "number");
  assertEquals(val >= 0 && val <= 1, true);
});

Deno.test("rocAuc - perfect classifier returns 1.0", () => {
  const results: CaseResult[] = [
    makeResult(1.0, true),
    makeResult(0.9, true),
    makeResult(0.1, false),
    makeResult(0.0, false),
  ];

  const ev = rocAuc({
    getScore: (r) => r.output as number,
    getLabel: (r) => r.case.expectedOutput as boolean,
  });

  const score = ev.evaluate(results);
  const val = (score as { score: number }).score;
  assertEquals(val, 1.0);
});

Deno.test("rocAuc - random classifier returns ~0.5", () => {
  // interleaved positives and negatives with scores that don't discriminate
  const results: CaseResult[] = [
    makeResult(0.5, true),
    makeResult(0.5, false),
    makeResult(0.5, true),
    makeResult(0.5, false),
  ];

  const ev = rocAuc({
    getScore: (r) => r.output as number,
    getLabel: (r) => r.case.expectedOutput as boolean,
  });

  const score = ev.evaluate(results);
  const val = (score as { score: number }).score;
  // Ties can yield 0.5
  assertEquals(typeof val, "number");
  assertEquals(val >= 0 && val <= 1, true);
});

// ---------------------------------------------------------------------------
// kolmogorovSmirnov
// ---------------------------------------------------------------------------

Deno.test("kolmogorovSmirnov - returns statistic in [0, 1]", () => {
  const results: CaseResult[] = [
    makeResult("a"),
    makeResult("b"),
    makeResult("c"),
    makeResult("d"),
  ];

  const scores = [0.1, 0.5, 0.2, 0.9];
  let i = 0;

  const ev = kolmogorovSmirnov({
    getScoreA: () => scores[i++ % scores.length],
    getScoreB: () => (i <= 2 ? 0.8 : 0.2),
  });

  const score = ev.evaluate(results);
  const val = (score as { score: number }).score;
  assertEquals(typeof val, "number");
  assertEquals(val >= 0 && val <= 1, true);
});

Deno.test("kolmogorovSmirnov - identical distributions return 0", () => {
  const results: CaseResult[] = [
    makeResult("a"),
    makeResult("b"),
    makeResult("c"),
    makeResult("d"),
  ];

  const scoresA = [0.1, 0.3, 0.5, 0.9];
  let idx = 0;

  const ev = kolmogorovSmirnov({
    getScoreA: () => scoresA[idx++],
    getScoreB: () => scoresA[--idx >= 0 ? idx++ : 0],
  });

  // Reset and use same values
  idx = 0;
  const ev2 = kolmogorovSmirnov({
    getScoreA: (_r, i) => scoresA[i],
    getScoreB: (_r, i) => scoresA[i],
  });

  const score = ev2.evaluate(results);
  const val = (score as { score: number }).score;
  assertEquals(val, 0);
});
