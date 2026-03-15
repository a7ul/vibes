/**
 * Dataset - the primary API for the Vibes evaluation framework.
 *
 * A Dataset holds a collection of Cases and evaluators, and provides the
 * `evaluate()` method to run experiments with configurable concurrency and retries.
 */

import { Semaphore } from "../concurrency.ts";
import type {
  Case,
  CaseResult,
  EvalScore,
  Evaluator,
  ExperimentResult,
  ReportEvaluator,
} from "./types.ts";
import { EvaluatorContext } from "./context.ts";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DatasetOptions<TInput, TExpected> {
  name?: string;
  cases: Case<TInput, TExpected>[];
  /** Dataset-level evaluators applied to every case. */
  evaluators?: Evaluator<unknown, TExpected>[];
  /** Experiment-wide report evaluators run after all cases complete. */
  reportEvaluators?: ReportEvaluator[];
}

export interface EvaluateOptions<_TOutput> {
  /** Maximum number of cases evaluated concurrently. Default: 5. */
  maxConcurrency?: number;
  /** Maximum number of times to retry a failing task. Default: 1. */
  maxRetries?: number;
  /** Callback invoked when each case completes (success or failure). */
  onCaseComplete?: (result: CaseResult) => void;
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

/**
 * An immutable collection of test Cases with associated evaluators.
 *
 * Use `Dataset.fromArray()`, `Dataset.fromJSON()`, or `Dataset.fromText()`
 * to create instances. Use `dataset.evaluate()` to run an experiment.
 *
 * @example
 * ```ts
 * const ds = Dataset.fromArray([
 *   { inputs: "hello", expectedOutput: "HELLO" },
 * ], { evaluators: [equalsExpected()] });
 *
 * const result = await ds.evaluate(async (input) => input.toUpperCase());
 * console.log(formatReport(result));
 * ```
 */
export class Dataset<TInput = unknown, TExpected = unknown> {
  readonly name: string | undefined;
  readonly cases: ReadonlyArray<Case<TInput, TExpected>>;
  readonly evaluators: ReadonlyArray<Evaluator>;
  readonly reportEvaluators: ReadonlyArray<ReportEvaluator>;

  private constructor(options: DatasetOptions<TInput, TExpected>) {
    this.name = options.name;
    this.cases = Object.freeze([...options.cases]);
    this.evaluators = Object.freeze([...(options.evaluators ?? [])]);
    this.reportEvaluators = Object.freeze([...(options.reportEvaluators ?? [])]);
  }

  // -------------------------------------------------------------------------
  // Factory methods
  // -------------------------------------------------------------------------

  /** Create a Dataset from an array of Cases. */
  static fromArray<TInput, TExpected>(
    cases: Case<TInput, TExpected>[],
    options?: Omit<DatasetOptions<TInput, TExpected>, "cases">,
  ): Dataset<TInput, TExpected> {
    return new Dataset({ ...options, cases });
  }

  /**
   * Create a Dataset from a JSON string or object.
   *
   * Accepts:
   * - A JSON string or object that is an array of Cases.
   * - A JSON string or object with a `cases` array property.
   */
  static fromJSON<TInput, TExpected>(
    json: string | object,
    options?: Omit<DatasetOptions<TInput, TExpected>, "cases">,
  ): Dataset<TInput, TExpected> {
    const parsed: unknown =
      typeof json === "string" ? JSON.parse(json) : json;

    let cases: Case<TInput, TExpected>[];
    if (Array.isArray(parsed)) {
      cases = parsed as Case<TInput, TExpected>[];
    } else if (
      typeof parsed === "object" &&
      parsed !== null &&
      "cases" in parsed &&
      Array.isArray((parsed as { cases: unknown }).cases)
    ) {
      cases = (parsed as { cases: Case<TInput, TExpected>[] }).cases;
    } else {
      throw new Error(
        "Dataset.fromJSON: expected an array of cases or an object with a 'cases' array",
      );
    }

    return new Dataset({ ...options, cases });
  }

  /**
   * Create a Dataset from a file path.
   *
   * Supports JSON format. YAML support requires @std/yaml (not currently
   * in deno.json; add it if needed).
   */
  static async fromFile<TInput, TExpected>(
    path: string,
    options?: Omit<DatasetOptions<TInput, TExpected>, "cases">,
  ): Promise<Dataset<TInput, TExpected>> {
    const text = await Deno.readTextFile(path);
    const format = path.endsWith(".json") ? "json" : "json";
    return Dataset.fromText<TInput, TExpected>(text, format, options);
  }

  /**
   * Create a Dataset from text content.
   *
   * @param text The raw text content.
   * @param format "json" (YAML is documented as future work; not yet available).
   */
  static fromText<TInput, TExpected>(
    text: string,
    format: "json" | "yaml",
    options?: Omit<DatasetOptions<TInput, TExpected>, "cases">,
  ): Dataset<TInput, TExpected> {
    if (format === "yaml") {
      throw new Error(
        "YAML format is not yet supported. Add @std/yaml to deno.json imports to enable it.",
      );
    }
    return Dataset.fromJSON<TInput, TExpected>(text, options);
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /** Serialize this Dataset to a plain JSON-compatible object. */
  toJSON(): object {
    return {
      name: this.name,
      cases: this.cases.map((c) => ({
        name: c.name,
        inputs: c.inputs,
        expectedOutput: c.expectedOutput,
        metadata: c.metadata,
        // Note: evaluators are functions and cannot be serialized
      })),
    };
  }

  /** Write this Dataset to a file. */
  async toFile(path: string, format: "json" | "yaml" = "json"): Promise<void> {
    if (format === "yaml") {
      throw new Error(
        "YAML format is not yet supported. Add @std/yaml to deno.json imports to enable it.",
      );
    }
    await Deno.writeTextFile(path, JSON.stringify(this.toJSON(), null, 2));
  }

  // -------------------------------------------------------------------------
  // Dataset manipulation (immutable)
  // -------------------------------------------------------------------------

  /**
   * Return a new Dataset containing only the cases that satisfy `predicate`.
   * All evaluators and options are preserved.
   */
  filter(
    predicate: (c: Case<TInput, TExpected>) => boolean,
  ): Dataset<TInput, TExpected> {
    return Dataset.fromArray<TInput, TExpected>(
      [...this.cases].filter(predicate),
      {
        name: this.name,
        evaluators: [...this.evaluators] as Evaluator<unknown, TExpected>[],
        reportEvaluators: [...this.reportEvaluators],
      },
    );
  }

  /**
   * Return a new Dataset with each Case transformed by `fn`.
   * All evaluators and options are preserved.
   */
  map<TInput2, TExpected2>(
    fn: (c: Case<TInput, TExpected>) => Case<TInput2, TExpected2>,
  ): Dataset<TInput2, TExpected2> {
    return Dataset.fromArray<TInput2, TExpected2>([...this.cases].map(fn), {
      name: this.name,
    });
  }

  // -------------------------------------------------------------------------
  // Iteration
  // -------------------------------------------------------------------------

  [Symbol.iterator](): Iterator<Case<TInput, TExpected>> {
    return this.cases[Symbol.iterator]();
  }

  // -------------------------------------------------------------------------
  // Evaluate (primary API)
  // -------------------------------------------------------------------------

  /**
   * Run the experiment: execute `task` for each Case, then run evaluators.
   *
   * Cases are run with configurable concurrency (default: 5 concurrent).
   * Failed tasks are captured per-case and do not abort the experiment.
   * Retries are applied transparently before recording a failure.
   *
   * @param task A function that receives the case input and returns a promise of output.
   * @param options Concurrency, retry, and callback options.
   */
  async evaluate<TOutput>(
    task: (input: TInput) => Promise<TOutput>,
    options?: EvaluateOptions<TOutput>,
  ): Promise<ExperimentResult<TInput, TExpected, TOutput>> {
    const maxConcurrency = options?.maxConcurrency ?? 5;
    const maxRetries = options?.maxRetries ?? 1;
    const onCaseComplete = options?.onCaseComplete;
    const sem = new Semaphore(maxConcurrency);

    const experimentStart = Date.now();
    const timestamp = new Date(experimentStart).toISOString();

    // Collect dataset-level evaluators
    const datasetEvaluators = [...this.evaluators] as Evaluator<
      TOutput,
      TExpected
    >[];

    // Run all cases concurrently (up to maxConcurrency)
    const casePromises = this.cases.map((c) =>
      sem.run(() =>
        runCase<TInput, TExpected, TOutput>(
          c,
          task,
          datasetEvaluators,
          maxRetries,
        )
      ).then((result) => {
        onCaseComplete?.(result);
        return result;
      })
    );

    const caseResults = await Promise.all(casePromises);

    // Run report-level evaluators
    for (const reportEv of this.reportEvaluators) {
      await reportEv.evaluate(caseResults);
    }

    const totalDuration = Date.now() - experimentStart;
    const summary = computeSummary(caseResults);

    return {
      cases: caseResults,
      summary,
      totalDuration,
      timestamp,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal: runCase
// ---------------------------------------------------------------------------

async function runCase<TInput, TExpected, TOutput>(
  c: Case<TInput, TExpected>,
  task: (input: TInput) => Promise<TOutput>,
  datasetEvaluators: Evaluator<TOutput, TExpected>[],
  maxRetries: number,
): Promise<CaseResult<TInput, TExpected, TOutput>> {
  let output: TOutput | undefined;
  let error: Error | undefined;
  let durationMs = 0;

  // Run task with retries
  const maxAttempts = maxRetries;
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const start = Date.now();
    try {
      output = await task(c.inputs);
      durationMs = Date.now() - start;
      lastError = undefined;
      break;
    } catch (e) {
      durationMs = Date.now() - start;
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts - 1) {
        // Will retry
        continue;
      }
    }
  }
  if (lastError !== undefined) {
    error = lastError;
  }

  // Build evaluator context
  const ctx = new EvaluatorContext<TInput, TExpected, TOutput>({
    inputs: c.inputs,
    output,
    expectedOutput: c.expectedOutput,
    metadata: c.metadata ?? {},
    spanTree: undefined,
    usage: undefined,
    durationMs,
  });

  // Run evaluators: dataset-level + per-case
  const allEvaluators: Evaluator<TOutput, TExpected>[] = [
    ...datasetEvaluators,
    ...((c.evaluators as Evaluator<TOutput, TExpected>[]) ?? []),
  ];

  const scores: Record<string, EvalScore> = {};
  for (const ev of allEvaluators) {
    try {
      const score = await ev.evaluate(ctx);
      scores[ev.name] = score;
    } catch (evErr) {
      scores[ev.name] = {
        score: false,
        reason: `Evaluator error: ${evErr instanceof Error ? evErr.message : String(evErr)}`,
      };
    }
  }

  return {
    case: c,
    output,
    error,
    scores,
    duration: durationMs,
    attributes: ctx.getAttributes(),
    metrics: ctx.getMetrics(),
  };
}

// ---------------------------------------------------------------------------
// Internal: computeSummary
// ---------------------------------------------------------------------------

function computeSummary(
  results: CaseResult[],
): Record<string, { mean: number; min: number; max: number; passRate?: number }> {
  // Collect all evaluator names
  const allNames = new Set<string>();
  for (const r of results) {
    for (const name of Object.keys(r.scores)) {
      allNames.add(name);
    }
  }

  const summary: Record<
    string,
    { mean: number; min: number; max: number; passRate?: number }
  > = {};

  for (const name of allNames) {
    const scores = results
      .filter((r) => name in r.scores)
      .map((r) => r.scores[name].score);

    const numericScores = scores.map(toNumeric);
    const hasBoolean = scores.some((s) => typeof s === "boolean");

    const mean =
      numericScores.length > 0
        ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length
        : 0;
    const min =
      numericScores.length > 0 ? Math.min(...numericScores) : 0;
    const max =
      numericScores.length > 0 ? Math.max(...numericScores) : 0;

    const entry: { mean: number; min: number; max: number; passRate?: number } =
      { mean, min, max };

    if (hasBoolean) {
      entry.passRate =
        numericScores.length > 0
          ? numericScores.filter((s) => s === 1).length / numericScores.length
          : 0;
    }

    summary[name] = entry;
  }

  return summary;
}

function toNumeric(score: number | boolean | string): number {
  if (typeof score === "boolean") return score ? 1 : 0;
  if (typeof score === "number") return score;
  return 0;
}
