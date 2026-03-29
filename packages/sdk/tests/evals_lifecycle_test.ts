/**
 * evals_lifecycle_test.ts
 *
 * Tests for CaseLifecycle hooks in Dataset.evaluate().
 */
import { assertEquals, assertExists } from "@std/assert";
import { Dataset } from "../lib/evals/dataset.ts";
import { CaseLifecycle } from "../lib/evals/lifecycle.ts";
import type { EvaluatorContext } from "../lib/evals/context.ts";
import type { Case, CaseResult } from "../lib/evals/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cases: Case<string, string>[] = [
  { name: "c1", inputs: "hello", expectedOutput: "HELLO" },
  { name: "c2", inputs: "world", expectedOutput: "WORLD" },
];

const ds = Dataset.fromArray(cases);
const upperTask = (input: string) => input.toUpperCase();

// ---------------------------------------------------------------------------
// Basic lifecycle hooks
// ---------------------------------------------------------------------------

Deno.test("CaseLifecycle - setup() is called before task", async () => {
  const order: string[] = [];

  class MyLifecycle extends CaseLifecycle<string, string, string> {
    override setup() {
      order.push("setup:" + this.case.inputs);
    }
  }

  await ds.evaluate(
    (input) => {
      order.push("task:" + input);
      return input.toUpperCase();
    },
    { lifecycle: MyLifecycle, maxConcurrency: 1 },
  );

  // setup should come before task for each case (maxConcurrency=1 → serial)
  assertEquals(order[0], "setup:hello");
  assertEquals(order[1], "task:hello");
  assertEquals(order[2], "setup:world");
  assertEquals(order[3], "task:world");
});

Deno.test("CaseLifecycle - teardown() is called after evaluators", async () => {
  const teardownCalled: string[] = [];

  class MyLifecycle extends CaseLifecycle<string, string, string> {
    override teardown(result: CaseResult<string, string, string>) {
      teardownCalled.push(result.case.inputs!);
    }
  }

  await ds.evaluate(upperTask, { lifecycle: MyLifecycle });

  assertEquals(teardownCalled.length, 2);
});

Deno.test("CaseLifecycle - prepareContext() can enrich metrics", async () => {
  class EnrichLifecycle extends CaseLifecycle<string, string, string> {
    override prepareContext(ctx: EvaluatorContext<string, string, string>) {
      ctx.incrementEvalMetric("custom_count", 1);
      return ctx;
    }
  }

  const result = await ds.evaluate(upperTask, {
    lifecycle: EnrichLifecycle,
  });

  // All cases should have custom_count = 1 (set by lifecycle)
  for (const r of result.cases) {
    assertEquals(r.metrics["custom_count"], 1);
  }
});

Deno.test("CaseLifecycle - prepareContext() receives correct output", async () => {
  let capturedOutput: string | undefined;

  class CaptureLifecycle extends CaseLifecycle<string, string, string> {
    override prepareContext(ctx: EvaluatorContext<string, string, string>) {
      capturedOutput = ctx.output;
      return ctx;
    }
  }

  const single = Dataset.fromArray<string, string>([
    { name: "only", inputs: "hello" },
  ]);
  await single.evaluate(upperTask, { lifecycle: CaptureLifecycle });

  assertEquals(capturedOutput, "HELLO");
});

Deno.test("CaseLifecycle - async hooks are awaited", async () => {
  const order: string[] = [];

  class AsyncLifecycle extends CaseLifecycle<string, string, string> {
    override async setup() {
      await Promise.resolve();
      order.push("setup");
    }
    override async teardown(_result: CaseResult<string, string, string>) {
      await Promise.resolve();
      order.push("teardown");
    }
  }

  const single = Dataset.fromArray<string, string>([{ inputs: "hi" }]);
  await single.evaluate(upperTask, { lifecycle: AsyncLifecycle });

  assertEquals(order, ["setup", "teardown"]);
});

Deno.test("CaseLifecycle - case property is set to the current case", async () => {
  const receivedCases: string[] = [];

  class InspectLifecycle extends CaseLifecycle<string, string, string> {
    override setup() {
      assertExists(this.case);
      receivedCases.push(this.case.inputs);
    }
  }

  await ds.evaluate(upperTask, { lifecycle: InspectLifecycle });

  assertEquals(receivedCases.length, 2);
  assertEquals(new Set(receivedCases), new Set(["hello", "world"]));
});

Deno.test("CaseLifecycle - teardown receives result with output", async () => {
  const outputs: string[] = [];

  class TeardownLifecycle extends CaseLifecycle<string, string, string> {
    override teardown(result: CaseResult<string, string, string>) {
      if (result.output !== undefined) outputs.push(result.output);
    }
  }

  await ds.evaluate(upperTask, { lifecycle: TeardownLifecycle });

  assertEquals(new Set(outputs), new Set(["HELLO", "WORLD"]));
});

Deno.test("CaseLifecycle - default no-op methods do not throw", async () => {
  // Concrete subclass with no overrides — default methods should be no-ops
  class NoopLifecycle extends CaseLifecycle<string, string, string> {}

  const result = await ds.evaluate(upperTask, { lifecycle: NoopLifecycle });
  assertEquals(result.cases.length, 2);
});

// ---------------------------------------------------------------------------
// Without lifecycle (baseline — options.lifecycle is undefined)
// ---------------------------------------------------------------------------

Deno.test("Dataset.evaluate - works without lifecycle option", async () => {
  const result = await ds.evaluate(upperTask);
  assertEquals(result.cases.length, 2);
});

Deno.test("Dataset.evaluate - lifecycle undefined is same as omitted", async () => {
  const result = await ds.evaluate(upperTask, { lifecycle: undefined });
  assertEquals(result.cases.length, 2);
});
