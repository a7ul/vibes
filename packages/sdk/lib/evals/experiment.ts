/**
 * Experiment runner - thin wrapper around Dataset.evaluate().
 *
 * Prefer using `dataset.evaluate()` directly. This function exists for
 * compatibility with the Pydantic AI API surface.
 */

import type {
  CaseResult,
  Evaluator,
  ExperimentResult,
  ReportEvaluator,
} from "./types.ts";
import { Dataset } from "./dataset.ts";

// ---------------------------------------------------------------------------
// RunExperimentOptions
// ---------------------------------------------------------------------------

export interface RunExperimentOptions<TInput, TExpected, TOutput> {
  /** The dataset of cases to evaluate. */
  dataset: Dataset<TInput, TExpected>;
  /** The task function to evaluate. */
  task: (input: TInput) => Promise<TOutput>;
  /**
   * Additional evaluators to run alongside the dataset's own evaluators.
   * These are merged with the dataset's evaluators.
   */
  evaluators?: Evaluator<TOutput, TExpected>[];
  /** Report-level evaluators run after all cases. */
  reportEvaluators?: ReportEvaluator<TInput, TExpected, TOutput>[];
  /** Maximum number of concurrent case evaluations. Default: 5. */
  maxConcurrency?: number;
  /** Maximum retry attempts per case. Default: 1. */
  maxRetries?: number;
  /** Callback invoked when each case completes. */
  onCaseComplete?: (result: CaseResult) => void;
}

// ---------------------------------------------------------------------------
// runExperiment
// ---------------------------------------------------------------------------

/**
 * Run an experiment over a dataset.
 *
 * This is a thin convenience wrapper around `Dataset.evaluate()`.
 * Additional evaluators and report evaluators passed here are merged
 * with those already on the dataset.
 *
 * @example
 * ```ts
 * const result = await runExperiment({
 *   dataset: myDataset,
 *   task: async (input) => model.generate(input),
 *   evaluators: [equalsExpected()],
 *   maxConcurrency: 3,
 * });
 * console.log(formatReport(result));
 * ```
 */
export function runExperiment<TInput, TExpected, TOutput>(
  options: RunExperimentOptions<TInput, TExpected, TOutput>,
): Promise<ExperimentResult<TInput, TExpected, TOutput>> {
  // Merge evaluators from options into the dataset
  const merged = options.evaluators?.length || options.reportEvaluators?.length
    ? Dataset.fromArray<TInput, TExpected>(
        [...options.dataset.cases] as import("./types.ts").Case<TInput, TExpected>[],
        {
          name: options.dataset.name,
          evaluators: [
            ...(options.dataset.evaluators as Evaluator<unknown, TExpected>[]),
            ...(options.evaluators ?? []) as Evaluator<unknown, TExpected>[],
          ],
          reportEvaluators: [
            ...options.dataset.reportEvaluators,
            ...(options.reportEvaluators ?? []),
          ],
        },
      )
    : options.dataset;

  return merged.evaluate<TOutput>(options.task, {
    maxConcurrency: options.maxConcurrency,
    maxRetries: options.maxRetries,
    onCaseComplete: options.onCaseComplete,
  });
}
