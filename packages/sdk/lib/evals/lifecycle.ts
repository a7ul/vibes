/**
 * Per-case lifecycle hooks for the Vibes evaluation framework.
 *
 * A direct TypeScript port of Pydantic AI's `CaseLifecycle` class.
 */

import type { EvaluatorContext } from "./context.ts";
import type { Case, CaseResult } from "./types.ts";

/**
 * Per-case lifecycle hooks for evaluation.
 *
 * Subclass and override any methods you need — all methods are no-ops by default.
 * A new instance is created for each case during evaluation.
 *
 * The evaluation flow for each case is:
 *
 * 1. `setup()` — called before task execution
 * 2. Task runs
 * 3. `prepareContext()` — called after task, before evaluators; can enrich metrics/attributes
 * 4. Evaluators run
 * 5. `teardown()` — called after evaluators complete; receives the full result
 *
 * Exceptions raised by `setup()` or `prepareContext()` are caught and recorded as a
 * failed case result; `teardown()` is still called afterward so you can clean up.
 * Exceptions raised by `teardown()` propagate to the caller and may abort the run.
 *
 * @example
 * ```ts
 * import { CaseLifecycle, Dataset } from "@vibesjs/sdk/evals";
 * import type { EvaluatorContext } from "@vibesjs/sdk/evals";
 *
 * class EnrichMetrics extends CaseLifecycle<string, string, string> {
 *   override prepareContext(ctx: EvaluatorContext<string, string, string>) {
 *     ctx.incrementEvalMetric("custom_metric", 1);
 *     return ctx;
 *   }
 * }
 *
 * const dataset = Dataset.fromArray([{ inputs: "hello" }]);
 * const result = await dataset.evaluate((input) => input.toUpperCase(), {
 *   lifecycle: EnrichMetrics,
 * });
 * ```
 */
export abstract class CaseLifecycle<
  TInput = unknown,
  TExpected = unknown,
  TOutput = unknown,
> {
  /** The case being evaluated. Available in all hook methods. */
  readonly case: Case<TInput, TExpected>;

  constructor(c: Case<TInput, TExpected>) {
    this.case = c;
  }

  /**
   * Called before task execution.
   *
   * Override to perform per-case resource setup (e.g., create a test database).
   * The case metadata is available via `this.case.metadata`.
   */
  setup(): void | Promise<void> {}

  /**
   * Called after the task completes, before evaluators run.
   *
   * Override to enrich the evaluator context with additional metrics or attributes
   * derived from the task output or external state.
   *
   * @param ctx The evaluator context produced by the task run.
   * @returns The (possibly modified) evaluator context to pass to evaluators.
   */
  prepareContext(
    ctx: EvaluatorContext<TInput, TExpected, TOutput>,
  ):
    | EvaluatorContext<TInput, TExpected, TOutput>
    | Promise<EvaluatorContext<TInput, TExpected, TOutput>> {
    return ctx;
  }

  /**
   * Called after evaluators complete.
   *
   * Override to perform per-case resource cleanup. The result is provided so that
   * teardown logic can vary based on success/failure.
   *
   * @param result The evaluation result for this case.
   */
  teardown(
    _result: CaseResult<TInput, TExpected, TOutput>,
  ): void | Promise<void> {}
}
