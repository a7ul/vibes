/**
 * evals_agentic_test.ts
 *
 * Tests for agentic span-based evaluators:
 * toolCorrectness, trajectoryMatch, argumentCorrectness, maxToolCalls, maxModelRequests
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  argumentCorrectness,
  maxModelRequests,
  maxToolCalls,
  toolCorrectness,
  trajectoryMatch,
} from "../lib/evals/agentic_evaluators.ts";
import { EvaluatorContext } from "../lib/evals/context.ts";
import { SpanTree } from "../lib/evals/span_tree.ts";
import type { SpanData } from "../lib/evals/span_tree.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(opts: {
  spanTree?: SpanTree;
  metrics?: Record<string, number>;
}): EvaluatorContext {
  return new EvaluatorContext({
    inputs: undefined,
    output: undefined,
    expectedOutput: undefined,
    metadata: {},
    spanTree: opts.spanTree,
    usage: undefined,
    durationMs: 0,
  });
}

const NOW = new Date();
const LATER = new Date(NOW.getTime() + 10);

function toolCallSpan(
  toolName: string,
  args?: Record<string, unknown>,
  status: SpanData["status"] = "ok",
): SpanData {
  return {
    name: "ai.toolCall",
    attributes: {
      "ai.toolCall.name": toolName,
      ...(args !== undefined
        ? { "ai.toolCall.args": JSON.stringify(args) }
        : {}),
    },
    durationMs: 10,
    startTime: NOW,
    endTime: LATER,
    status,
    events: [],
    children: [],
  };
}

function modelRequestSpan(name = "ai.generateText.doGenerate"): SpanData {
  return {
    name,
    attributes: {},
    durationMs: 50,
    startTime: NOW,
    endTime: LATER,
    status: "ok",
    events: [],
    children: [],
  };
}

function makeTree(spans: SpanData[]): SpanTree {
  return SpanTree.fromSpanData(spans);
}

// ---------------------------------------------------------------------------
// toolCorrectness
// ---------------------------------------------------------------------------

Deno.test("toolCorrectness - passes when expected tools called exactly", () => {
  const tree = makeTree([
    toolCallSpan("search"),
    toolCallSpan("rerank"),
    toolCallSpan("generate"),
  ]);
  const ev = toolCorrectness({ expectedTools: ["search", "rerank", "generate"] });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("toolCorrectness - fails when expected tool missing", () => {
  const tree = makeTree([toolCallSpan("search"), toolCallSpan("rerank")]);
  const ev = toolCorrectness({
    expectedTools: ["search", "rerank", "generate"],
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean; reason: string };
  assertEquals(result.score, false);
  assertExists(result.reason.includes("missing"));
});

Deno.test("toolCorrectness - fails when unexpected tool present", () => {
  const tree = makeTree([
    toolCallSpan("search"),
    toolCallSpan("unexpected_tool"),
  ]);
  const ev = toolCorrectness({ expectedTools: ["search"] });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("toolCorrectness - allowExtra ignores extra tools", () => {
  const tree = makeTree([
    toolCallSpan("search"),
    toolCallSpan("bonus_tool"),
  ]);
  const ev = toolCorrectness({ expectedTools: ["search"], allowExtra: true });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("toolCorrectness - requires duplicate expected tools", () => {
  const tree = makeTree([toolCallSpan("search")]);
  const ev = toolCorrectness({ expectedTools: ["search", "search"] });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("toolCorrectness - fails gracefully without span tree", () => {
  const ev = toolCorrectness({ expectedTools: ["search"] });
  const ctx = makeCtx({});
  const result = ev.evaluate(ctx) as { score: boolean; reason: string };
  assertEquals(result.score, false);
  assertExists(result.reason);
});

Deno.test("toolCorrectness - excludes failed spans by default", () => {
  const tree = makeTree([
    toolCallSpan("search", {}, "error"),
    toolCallSpan("rerank"),
  ]);
  // Only 'rerank' is counted (not the failed 'search')
  const ev = toolCorrectness({ expectedTools: ["rerank"] });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("toolCorrectness - includeFailed counts failed spans", () => {
  const tree = makeTree([
    toolCallSpan("search", {}, "error"),
    toolCallSpan("rerank"),
  ]);
  const ev = toolCorrectness({
    expectedTools: ["search", "rerank"],
    includeFailed: true,
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("toolCorrectness - uses custom evaluation name", () => {
  const ev = toolCorrectness({
    expectedTools: [],
    evaluationName: "myCheck",
  });
  assertEquals(ev.name, "myCheck");
});

// ---------------------------------------------------------------------------
// trajectoryMatch
// ---------------------------------------------------------------------------

Deno.test("trajectoryMatch - exact mode passes on exact match", () => {
  const tree = makeTree([
    toolCallSpan("a"),
    toolCallSpan("b"),
    toolCallSpan("c"),
  ]);
  const ev = trajectoryMatch({
    expectedTrajectory: ["a", "b", "c"],
    order: "exact",
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: number };
  assertEquals(result.score, 1);
});

Deno.test("trajectoryMatch - exact mode fails on different order", () => {
  const tree = makeTree([toolCallSpan("b"), toolCallSpan("a")]);
  const ev = trajectoryMatch({
    expectedTrajectory: ["a", "b"],
    order: "exact",
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: number };
  assertEquals(result.score, 0);
});

Deno.test("trajectoryMatch - in_order mode gives partial credit", () => {
  // actual = [a, x, b], expected = [a, b, c]
  // LCS = [a, b] = 2
  // precision = 2/3, recall = 2/3, F1 = 2/3
  const tree = makeTree([
    toolCallSpan("a"),
    toolCallSpan("x"),
    toolCallSpan("b"),
  ]);
  const ev = trajectoryMatch({
    expectedTrajectory: ["a", "b", "c"],
    order: "in_order",
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: number };
  // F1 = 2/3 ≈ 0.667
  assertEquals(result.score > 0.6 && result.score < 0.7, true);
});

Deno.test("trajectoryMatch - any_order mode is order-insensitive", () => {
  const tree = makeTree([toolCallSpan("b"), toolCallSpan("a"), toolCallSpan("c")]);
  const ev = trajectoryMatch({
    expectedTrajectory: ["a", "b", "c"],
    order: "any_order",
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: number };
  assertEquals(result.score, 1);
});

Deno.test("trajectoryMatch - both empty returns 1", () => {
  const tree = makeTree([]);
  const ev = trajectoryMatch({ expectedTrajectory: [] });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: number };
  assertEquals(result.score, 1);
});

Deno.test("trajectoryMatch - only actual empty returns 0", () => {
  const tree = makeTree([]);
  const ev = trajectoryMatch({ expectedTrajectory: ["a"] });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: number };
  assertEquals(result.score, 0);
});

Deno.test("trajectoryMatch - fails gracefully without span tree", () => {
  const ev = trajectoryMatch({ expectedTrajectory: ["a"] });
  const ctx = makeCtx({});
  const result = ev.evaluate(ctx) as { score: number; reason: string };
  assertEquals(result.score, 0);
  assertExists(result.reason);
});

// ---------------------------------------------------------------------------
// argumentCorrectness
// ---------------------------------------------------------------------------

Deno.test("argumentCorrectness - passes for subset match", () => {
  const tree = makeTree([
    toolCallSpan("issue_refund", { order_id: "12345", amount: 100 }),
  ]);
  const ev = argumentCorrectness({
    toolName: "issue_refund",
    expectedArguments: { order_id: "12345" },
    matchMode: "subset",
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("argumentCorrectness - fails for subset when value differs", () => {
  const tree = makeTree([
    toolCallSpan("issue_refund", { order_id: "99999" }),
  ]);
  const ev = argumentCorrectness({
    toolName: "issue_refund",
    expectedArguments: { order_id: "12345" },
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("argumentCorrectness - exact mode fails on extra keys", () => {
  const tree = makeTree([
    toolCallSpan("tool", { a: 1, b: 2 }),
  ]);
  const ev = argumentCorrectness({
    toolName: "tool",
    expectedArguments: { a: 1 },
    matchMode: "exact",
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("argumentCorrectness - occurrence 'last' checks last call", () => {
  const tree = makeTree([
    toolCallSpan("tool", { v: 1 }),
    toolCallSpan("tool", { v: 2 }),
  ]);
  const ev = argumentCorrectness({
    toolName: "tool",
    expectedArguments: { v: 2 },
    occurrence: "last",
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("argumentCorrectness - fails when tool not called", () => {
  const tree = makeTree([toolCallSpan("other")]);
  const ev = argumentCorrectness({
    toolName: "missing_tool",
    expectedArguments: { x: 1 },
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean; reason: string };
  assertEquals(result.score, false);
  assertExists(result.reason.includes("never called"));
});

Deno.test("argumentCorrectness - fails when args not available", () => {
  const tree = makeTree([
    {
      name: "ai.toolCall",
      attributes: { "ai.toolCall.name": "tool" }, // no args attribute
      durationMs: 10,
      startTime: NOW,
      endTime: LATER,
      status: "ok",
      events: [],
      children: [],
    },
  ]);
  const ev = argumentCorrectness({
    toolName: "tool",
    expectedArguments: { x: 1 },
  });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("argumentCorrectness - fails gracefully without span tree", () => {
  const ev = argumentCorrectness({
    toolName: "tool",
    expectedArguments: { x: 1 },
  });
  const ctx = makeCtx({});
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

// ---------------------------------------------------------------------------
// maxToolCalls
// ---------------------------------------------------------------------------

Deno.test("maxToolCalls - passes when under budget", () => {
  const tree = makeTree([
    toolCallSpan("a"),
    toolCallSpan("b"),
  ]);
  const ev = maxToolCalls({ maxCalls: 5 });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("maxToolCalls - passes at exact budget", () => {
  const tree = makeTree([toolCallSpan("a"), toolCallSpan("b"), toolCallSpan("c")]);
  const ev = maxToolCalls({ maxCalls: 3 });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("maxToolCalls - fails when over budget", () => {
  const tree = makeTree([
    toolCallSpan("a"),
    toolCallSpan("b"),
    toolCallSpan("c"),
    toolCallSpan("d"),
  ]);
  const ev = maxToolCalls({ maxCalls: 3 });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("maxToolCalls - includes failed spans by default", () => {
  const tree = makeTree([
    toolCallSpan("a", {}, "error"),
    toolCallSpan("b"),
    toolCallSpan("c"),
    toolCallSpan("d"),
  ]);
  const ev = maxToolCalls({ maxCalls: 3 });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false); // 4 total including failed
});

Deno.test("maxToolCalls - includeFailed false excludes error spans", () => {
  const tree = makeTree([
    toolCallSpan("a", {}, "error"),
    toolCallSpan("b"),
  ]);
  const ev = maxToolCalls({ maxCalls: 1, includeFailed: false });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true); // only 1 successful call
});

Deno.test("maxToolCalls - fails gracefully without span tree", () => {
  const ev = maxToolCalls({ maxCalls: 5 });
  const ctx = makeCtx({});
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

// ---------------------------------------------------------------------------
// maxModelRequests
// ---------------------------------------------------------------------------

Deno.test("maxModelRequests - passes when under budget via spans", () => {
  const tree = makeTree([
    modelRequestSpan("ai.generateText.doGenerate"),
    modelRequestSpan("ai.generateText.doGenerate"),
  ]);
  const ev = maxModelRequests({ maxRequests: 3 });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("maxModelRequests - fails when over budget via spans", () => {
  const tree = makeTree([
    modelRequestSpan("ai.generateText.doGenerate"),
    modelRequestSpan("ai.streamText.doGenerate"),
    modelRequestSpan("ai.generateText.doGenerate"),
    modelRequestSpan("ai.streamText.doGenerate"),
  ]);
  const ev = maxModelRequests({ maxRequests: 3 });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("maxModelRequests - non-model spans are not counted", () => {
  const tree = makeTree([
    toolCallSpan("some_tool"),
    modelRequestSpan("ai.generateText.doGenerate"),
  ]);
  const ev = maxModelRequests({ maxRequests: 1 });
  const ctx = makeCtx({ spanTree: tree });
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, true);
});

Deno.test("maxModelRequests - fails gracefully without span tree", () => {
  const ev = maxModelRequests({ maxRequests: 5 });
  const ctx = makeCtx({});
  const result = ev.evaluate(ctx) as { score: boolean };
  assertEquals(result.score, false);
});

Deno.test("maxModelRequests - uses custom evaluation name", () => {
  const ev = maxModelRequests({ maxRequests: 3, evaluationName: "budgetCheck" });
  assertEquals(ev.name, "budgetCheck");
});
