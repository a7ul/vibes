/**
 * evals_evaluators_test.ts
 *
 * Tests for all built-in case-level evaluators.
 */
import { assertEquals, assertExists } from "@std/assert";
import { z } from "zod";
import {
  contains,
  custom,
  equals,
  equalsExpected,
  hasMatchingSpan,
  isInstance,
  isValidSchema,
  maxDuration,
} from "../lib/evals/builtin_evaluators.ts";
import { EvaluatorContext } from "../lib/evals/context.ts";
import { SpanTree } from "../lib/evals/span_tree.ts";
import type { SpanData } from "../lib/evals/span_tree.ts";

function makeCtx<TInput = unknown, TExpected = unknown, TOutput = unknown>(opts: {
  inputs?: TInput;
  output?: TOutput;
  expectedOutput?: TExpected;
  durationMs?: number;
  spanTree?: SpanTree;
}): EvaluatorContext<TInput, TExpected, TOutput> {
  return new EvaluatorContext({
    inputs: opts.inputs as TInput,
    output: opts.output,
    expectedOutput: opts.expectedOutput,
    metadata: {},
    spanTree: opts.spanTree,
    usage: undefined,
    durationMs: opts.durationMs ?? 0,
  });
}

function makeSpanData(name: string, children: SpanData[] = []): SpanData {
  const now = new Date();
  return {
    name,
    attributes: {},
    durationMs: 10,
    startTime: now,
    endTime: new Date(now.getTime() + 10),
    status: "ok",
    events: [],
    children,
  };
}

// ---------------------------------------------------------------------------
// equalsExpected
// ---------------------------------------------------------------------------

Deno.test("equalsExpected - passes when output === expectedOutput", () => {
  const ev = equalsExpected();
  const ctx = makeCtx({ output: "hello", expectedOutput: "hello" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("equalsExpected - fails when output !== expectedOutput", () => {
  const ev = equalsExpected();
  const ctx = makeCtx({ output: "hello", expectedOutput: "world" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("equalsExpected - fails gracefully when expectedOutput is undefined", () => {
  const ev = equalsExpected();
  const ctx = makeCtx({ output: "hello" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

// ---------------------------------------------------------------------------
// equals
// ---------------------------------------------------------------------------

Deno.test("equals - passes when output matches value", () => {
  const ev = equals("hello");
  const ctx = makeCtx({ output: "hello" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("equals - fails when output differs", () => {
  const ev = equals("hello");
  const ctx = makeCtx({ output: "world" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("equals - uses custom evaluation name", () => {
  const ev = equals("x", "my-check");
  assertEquals(ev.name, "my-check");
});

// ---------------------------------------------------------------------------
// contains
// ---------------------------------------------------------------------------

Deno.test("contains - passes when string output contains value", () => {
  const ev = contains("foo");
  const ctx = makeCtx({ output: "foobar" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("contains - fails when string output does not contain value", () => {
  const ev = contains("baz");
  const ctx = makeCtx({ output: "foobar" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("contains - case insensitive", () => {
  const ev = contains("FOO", { caseSensitive: false });
  const ctx = makeCtx({ output: "foobar" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("contains - case sensitive by default", () => {
  const ev = contains("FOO");
  const ctx = makeCtx({ output: "foobar" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("contains - asStrings converts output to string", () => {
  const ev = contains("42", { asStrings: true });
  const ctx = makeCtx({ output: 42 });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

// ---------------------------------------------------------------------------
// isInstance
// ---------------------------------------------------------------------------

Deno.test("isInstance - passes for string", () => {
  const ev = isInstance("string");
  const ctx = makeCtx({ output: "hello" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("isInstance - fails for number when string expected", () => {
  const ev = isInstance("string");
  const ctx = makeCtx({ output: 42 });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("isInstance - passes for number", () => {
  const ev = isInstance("number");
  const ctx = makeCtx({ output: 42 });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("isInstance - passes for boolean", () => {
  const ev = isInstance("boolean");
  const ctx = makeCtx({ output: true });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("isInstance - passes for object", () => {
  const ev = isInstance("object");
  const ctx = makeCtx({ output: {} });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

// ---------------------------------------------------------------------------
// maxDuration
// ---------------------------------------------------------------------------

Deno.test("maxDuration - passes when duration < limit", () => {
  const ev = maxDuration(5); // 5 seconds
  const ctx = makeCtx({ durationMs: 100 }); // 100ms < 5000ms
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("maxDuration - fails when duration > limit", () => {
  const ev = maxDuration(1); // 1 second = 1000ms
  const ctx = makeCtx({ durationMs: 2000 }); // 2000ms > 1000ms
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("maxDuration - passes at exact boundary", () => {
  const ev = maxDuration(1); // 1 second = 1000ms
  const ctx = makeCtx({ durationMs: 1000 }); // exactly 1000ms
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

// ---------------------------------------------------------------------------
// hasMatchingSpan
// ---------------------------------------------------------------------------

Deno.test("hasMatchingSpan - passes when span tree has matching node", () => {
  const spanData = makeSpanData("target");
  const tree = SpanTree.fromSpanData([spanData]);
  const ev = hasMatchingSpan((n) => n.name === "target");
  const ctx = makeCtx({ spanTree: tree });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("hasMatchingSpan - fails when no matching span", () => {
  const spanData = makeSpanData("root");
  const tree = SpanTree.fromSpanData([spanData]);
  const ev = hasMatchingSpan((n) => n.name === "missing");
  const ctx = makeCtx({ spanTree: tree });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("hasMatchingSpan - fails when spanTree is undefined", () => {
  const ev = hasMatchingSpan((n) => n.name === "anything");
  const ctx = makeCtx({});
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

// ---------------------------------------------------------------------------
// isValidSchema
// ---------------------------------------------------------------------------

Deno.test("isValidSchema - passes for valid string", () => {
  const ev = isValidSchema(z.string());
  const ctx = makeCtx({ output: "hello" });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("isValidSchema - fails for number against string schema", () => {
  const ev = isValidSchema(z.string());
  const ctx = makeCtx({ output: 42 });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, false);
});

Deno.test("isValidSchema - passes for valid object", () => {
  const schema = z.object({ name: z.string(), age: z.number() });
  const ev = isValidSchema(schema);
  const ctx = makeCtx({ output: { name: "Alice", age: 30 } });
  const score = ev.evaluate(ctx);
  assertEquals((score as { score: boolean }).score, true);
});

Deno.test("isValidSchema - has reason on failure", () => {
  const ev = isValidSchema(z.string());
  const ctx = makeCtx({ output: 42 });
  const score = ev.evaluate(ctx);
  assertExists((score as { reason?: string }).reason);
});

// ---------------------------------------------------------------------------
// custom
// ---------------------------------------------------------------------------

Deno.test("custom - calls provided function with context", () => {
  let called = false;
  const ev = custom("my-eval", (ctx) => {
    called = true;
    assertExists(ctx);
    return { score: true };
  });
  const ctx = makeCtx({ output: "x" });
  ev.evaluate(ctx);
  assertEquals(called, true);
});

Deno.test("custom - name is set correctly", () => {
  const ev = custom("my-name", () => ({ score: 0.5 }));
  assertEquals(ev.name, "my-name");
});

Deno.test("custom - async evaluator works", async () => {
  const ev = custom("async-eval", async () => {
    await Promise.resolve();
    return { score: true };
  });
  const ctx = makeCtx({});
  const result = await ev.evaluate(ctx);
  assertEquals((result as { score: boolean }).score, true);
});
