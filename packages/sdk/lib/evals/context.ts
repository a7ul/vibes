/**
 * EvaluatorContext - context object passed to each evaluator.
 *
 * Provides read access to inputs, output, expectedOutput, metadata, span tree,
 * and usage. Also supports accumulating attributes and metrics.
 *
 * Note: Unlike Pydantic AI's Python version, standalone `setEvalAttribute` and
 * `incrementEvalMetric` functions are not provided because Deno lacks AsyncLocalStorage
 * as a built-in. Use `ctx.setEvalAttribute()` and `ctx.incrementEvalMetric()` directly.
 */

import type { SpanTree } from "./span_tree.ts";

// ---------------------------------------------------------------------------
// EvaluatorContextOptions
// ---------------------------------------------------------------------------

/** Options for constructing an EvaluatorContext. */
export interface EvaluatorContextOptions<
  TInput = unknown,
  TExpected = unknown,
  TOutput = unknown,
> {
  inputs: TInput;
  output: TOutput | undefined;
  expectedOutput: TExpected | undefined;
  metadata: Record<string, unknown>;
  spanTree: SpanTree | undefined;
  usage:
    | { inputTokens: number; outputTokens: number; totalTokens: number }
    | undefined;
  /** Wall-clock duration of task execution in milliseconds. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// EvaluatorContext
// ---------------------------------------------------------------------------

/**
 * Context passed to each evaluator during case evaluation.
 *
 * Provides read access to task inputs/outputs and supports setting
 * attributes/metrics that will be included in the final CaseResult.
 */
export class EvaluatorContext<
  TInput = unknown,
  TExpected = unknown,
  TOutput = unknown,
> {
  readonly inputs: TInput;
  readonly output: TOutput | undefined;
  readonly expectedOutput: TExpected | undefined;
  readonly metadata: Record<string, unknown>;
  readonly spanTree: SpanTree | undefined;
  readonly usage:
    | { inputTokens: number; outputTokens: number; totalTokens: number }
    | undefined;

  /**
   * Wall-clock duration of the task execution in milliseconds.
   * Used by evaluators like `maxDuration`.
   */
  readonly durationMs: number;

  private readonly _attributes: Record<string, unknown>;
  private readonly _metrics: Record<string, number>;

  constructor(options: EvaluatorContextOptions<TInput, TExpected, TOutput>) {
    this.inputs = options.inputs;
    this.output = options.output;
    this.expectedOutput = options.expectedOutput;
    this.metadata = { ...options.metadata };
    this.spanTree = options.spanTree;
    this.usage = options.usage;
    this.durationMs = options.durationMs;
    this._attributes = {};
    this._metrics = {};
  }

  /**
   * Set an arbitrary attribute on this context.
   * Attributes are collected into `CaseResult.attributes`.
   */
  setEvalAttribute(name: string, value: unknown): void {
    this._attributes[name] = value;
  }

  /**
   * Increment a named metric counter.
   * Metrics are collected into `CaseResult.metrics`.
   */
  incrementEvalMetric(name: string, value: number): void {
    this._metrics[name] = (this._metrics[name] ?? 0) + value;
  }

  /** Returns a snapshot of all attributes set on this context. */
  getAttributes(): Record<string, unknown> {
    return { ...this._attributes };
  }

  /** Returns a snapshot of all metrics accumulated on this context. */
  getMetrics(): Record<string, number> {
    return { ...this._metrics };
  }
}
