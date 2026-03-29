/**
 * Vibes Evaluation Framework
 *
 * A 1-1 TypeScript port of Pydantic AI's evals module.
 *
 * @example
 * ```ts
 * import { Dataset, equalsExpected, formatReport } from "@vibesjs/sdk/evals";
 *
 * const ds = Dataset.fromArray([
 *   { inputs: "hello", expectedOutput: "HELLO" },
 * ], { evaluators: [equalsExpected()] });
 *
 * const result = await ds.evaluate(async (input) => input.toUpperCase());
 * console.log(formatReport(result));
 * ```
 */

// Core types
export type {
  Case,
  CaseResult,
  EvalScore,
  EvaluationReason,
  Evaluator,
  ExperimentResult,
  ReportEvaluator,
} from "./types.ts";
export { EvalError } from "./types.ts";

// Context
export { EvaluatorContext } from "./context.ts";
export type { EvaluatorContextOptions } from "./context.ts";

// SpanTree
export { SpanNode, SpanTree } from "./span_tree.ts";
export type { SpanData } from "./span_tree.ts";

// Dataset
export { Dataset } from "./dataset.ts";
export type { DatasetOptions, EvaluateOptions } from "./dataset.ts";

// Lifecycle
export { CaseLifecycle } from "./lifecycle.ts";

// Built-in case-level evaluators
export {
  contains,
  custom,
  equals,
  equalsExpected,
  hasMatchingSpan,
  isInstance,
  isValidSchema,
  maxDuration,
} from "./builtin_evaluators.ts";

// Report-level evaluators
export {
  confusionMatrix,
  kolmogorovSmirnov,
  precisionRecall,
  rocAuc,
} from "./report_evaluators.ts";

// LLM judge
export {
  judgeInputOutput,
  judgeInputOutputExpected,
  judgeOutput,
  judgeOutputExpected,
  llmJudge,
  setDefaultJudgeModel,
} from "./llm_judge.ts";
export type { LLMJudgeOptions } from "./llm_judge.ts";

// Dataset generation
export { generateDataset } from "./generation.ts";
export type { GenerateDatasetOptions } from "./generation.ts";

// Experiment runner
export { runExperiment } from "./experiment.ts";
export type { RunExperimentOptions } from "./experiment.ts";

// Report formatting
export { formatReport, toJSON } from "./report.ts";
