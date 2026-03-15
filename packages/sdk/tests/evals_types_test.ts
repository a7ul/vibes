/**
 * evals_types_test.ts
 *
 * Compile-time and basic runtime checks for evals type definitions.
 */
import { assertEquals, assertExists } from "@std/assert";
import type {
  Case,
  CaseResult,
  EvalScore,
  EvaluationReason,
  Evaluator,
  ExperimentResult,
  ReportEvaluator,
} from "../lib/evals/types.ts";

// ---------------------------------------------------------------------------
// EvalScore assignability
// ---------------------------------------------------------------------------

Deno.test("EvalScore - accepts number score", () => {
  const s: EvalScore = { score: 0.85 };
  assertEquals(typeof s.score, "number");
});

Deno.test("EvalScore - accepts boolean score", () => {
  const s: EvalScore = { score: true };
  assertEquals(typeof s.score, "boolean");
});

Deno.test("EvalScore - accepts string score", () => {
  const s: EvalScore = { score: "pass" };
  assertEquals(typeof s.score, "string");
});

Deno.test("EvalScore - optional label and reason", () => {
  const s: EvalScore = { score: 0.5, label: "partial", reason: "halfway" };
  assertEquals(s.label, "partial");
  assertEquals(s.reason, "halfway");
});

// ---------------------------------------------------------------------------
// EvaluationReason
// ---------------------------------------------------------------------------

Deno.test("EvaluationReason - requires score and reason", () => {
  const er: EvaluationReason = { score: true, reason: "looks good" };
  assertEquals(er.score, true);
  assertEquals(er.reason, "looks good");
});

// ---------------------------------------------------------------------------
// Case
// ---------------------------------------------------------------------------

Deno.test("Case - inputs required, rest optional", () => {
  const c: Case<string, string> = { inputs: "hello" };
  assertExists(c.inputs);
  assertEquals(c.name, undefined);
  assertEquals(c.expectedOutput, undefined);
});

Deno.test("Case - full object", () => {
  const c: Case<string, number> = {
    name: "my case",
    inputs: "hello",
    expectedOutput: 42,
    metadata: { tag: "smoke" },
  };
  assertEquals(c.name, "my case");
  assertEquals(c.expectedOutput, 42);
});

// ---------------------------------------------------------------------------
// CaseResult
// ---------------------------------------------------------------------------

Deno.test("CaseResult - shape is correct", () => {
  const cr: CaseResult<string, string, string> = {
    case: { inputs: "hello" },
    output: "world",
    error: undefined,
    scores: {},
    duration: 42,
    attributes: {},
    metrics: {},
  };
  assertEquals(cr.duration, 42);
  assertEquals(cr.output, "world");
});

// ---------------------------------------------------------------------------
// ExperimentResult
// ---------------------------------------------------------------------------

Deno.test("ExperimentResult - shape is correct", () => {
  const er: ExperimentResult = {
    cases: [],
    summary: {},
    totalDuration: 100,
    timestamp: new Date().toISOString(),
  };
  assertEquals(er.cases.length, 0);
  assertExists(er.timestamp);
});

// ---------------------------------------------------------------------------
// Evaluator interface
// ---------------------------------------------------------------------------

Deno.test("Evaluator - custom implementation satisfies interface", () => {
  const ev: Evaluator<string, string> = {
    name: "always-pass",
    evaluate(_ctx) {
      return { score: true };
    },
  };
  assertEquals(ev.name, "always-pass");
  assertExists(ev.evaluate);
});

// ---------------------------------------------------------------------------
// ReportEvaluator interface
// ---------------------------------------------------------------------------

Deno.test("ReportEvaluator - custom implementation satisfies interface", () => {
  const rev: ReportEvaluator = {
    name: "report-eval",
    evaluate(_results) {
      return { score: 1.0, reason: "all good" };
    },
  };
  assertEquals(rev.name, "report-eval");
  assertExists(rev.evaluate);
});
