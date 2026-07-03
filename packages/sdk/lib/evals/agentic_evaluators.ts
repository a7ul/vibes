/**
 * Agentic span-based evaluators for the Vibes evaluation framework.
 *
 * Deterministic evaluators that grade an agent's *trajectory* — the sequence
 * and arguments of tool calls — using the OpenTelemetry span tree captured
 * during task execution.
 *
 * ## Span naming conventions
 *
 * These evaluators inspect spans from the Vercel AI SDK and Vibes instrumentation:
 *
 * - **Tool call span**: a span whose `name` starts with `"ai.toolCall"`.
 *   - `attributes["ai.toolCall.name"]` — the tool name (string).
 *   - `attributes["ai.toolCall.args"]` — tool arguments as a JSON string (may be absent).
 *   - `status === "error"` — indicates a failed/errored tool call.
 *
 * - **Model request span**: a span whose `name` starts with `"ai.generateText"` or
 *   `"ai.streamText"`.
 *
 * If `ctx.spanTree` is `undefined` (e.g. instrumentation wasn't enabled),
 * each evaluator returns a failing result with a descriptive reason rather than
 * throwing.
 */

import type { EvalScore, Evaluator } from "./types.ts";
import type { EvaluatorContext } from "./context.ts";
import type { SpanNode } from "./span_tree.ts";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true if a span represents a locally-executed tool call. */
function isToolCallSpan(node: SpanNode): boolean {
  return node.name.startsWith("ai.toolCall");
}

/** Returns true if a span represents a model (LLM) request. */
function isModelRequestSpan(node: SpanNode): boolean {
  return (
    node.name.startsWith("ai.generateText") ||
    node.name.startsWith("ai.streamText")
  );
}

/** Returns the tool name from a tool call span, or undefined if not present. */
function toolNameFromSpan(node: SpanNode): string | undefined {
  const v = node.attributes["ai.toolCall.name"];
  return typeof v === "string" ? v : undefined;
}

/**
 * Returns the parsed arguments from a tool call span.
 *
 * The AI SDK stores args as a JSON string in `ai.toolCall.args`.
 * Returns `undefined` when the attribute is absent or unparseable.
 */
function argsFromSpan(node: SpanNode): Record<string, unknown> | undefined {
  const raw = node.attributes["ai.toolCall.args"];
  if (typeof raw !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Collect tool call spans (optionally including failed ones) from a span tree. */
function collectToolCallSpans(
  ctx: EvaluatorContext,
  includeFailed: boolean,
): SpanNode[] | null {
  if (!ctx.spanTree) return null;
  const spans: SpanNode[] = [];
  for (const node of ctx.spanTree) {
    if (!isToolCallSpan(node)) continue;
    if (!includeFailed && node.status === "error") continue;
    spans.push(node);
  }
  return spans;
}

const NO_SPAN_TREE_REASON =
  "No span tree available. Enable instrumentation (e.g. via instrumentAgent()) to capture spans.";

// ---------------------------------------------------------------------------
// ToolCorrectness
// ---------------------------------------------------------------------------

/**
 * Options for {@link toolCorrectness}.
 */
export interface ToolCorrectnessOptions {
  /**
   * Tool names the agent is expected to call. Order does not matter; duplicates
   * are significant — `['search', 'search']` requires two `search` calls.
   */
  expectedTools: string[];
  /**
   * When `false` (default), any tool call NOT in `expectedTools` causes failure.
   * When `true`, only the presence of all expected tools is checked.
   */
  allowExtra?: boolean;
  /**
   * Whether to count tool-call attempts that ended in an error. Default: false.
   */
  includeFailed?: boolean;
  /** Override the evaluator name shown in reports. */
  evaluationName?: string;
}

/**
 * Assert that the agent called a specific multiset of tools.
 *
 * Repeated names require repeated calls: `['search', 'search']` requires
 * two `search` calls. Order is not checked.
 *
 * @example
 * ```ts
 * const ev = toolCorrectness({ expectedTools: ['search', 'rerank', 'generate'] });
 * ```
 */
export function toolCorrectness(options: ToolCorrectnessOptions): Evaluator {
  return {
    name: options.evaluationName ?? "toolCorrectness",
    evaluate(ctx: EvaluatorContext): EvalScore {
      const spans = collectToolCallSpans(ctx, options.includeFailed ?? false);
      if (spans === null) {
        return { score: false, reason: NO_SPAN_TREE_REASON };
      }

      const actual = spans.map((s) => toolNameFromSpan(s) ?? s.name);

      // Build frequency maps
      const expectedFreq = new Map<string, number>();
      for (const t of options.expectedTools) {
        expectedFreq.set(t, (expectedFreq.get(t) ?? 0) + 1);
      }

      const actualFreq = new Map<string, number>();
      for (const t of actual) {
        actualFreq.set(t, (actualFreq.get(t) ?? 0) + 1);
      }

      const missing: string[] = [];
      for (const [tool, count] of expectedFreq) {
        const got = actualFreq.get(tool) ?? 0;
        for (let i = 0; i < count - got; i++) missing.push(tool);
      }

      const unexpected: string[] = [];
      if (!(options.allowExtra ?? false)) {
        for (const [tool, count] of actualFreq) {
          const wanted = expectedFreq.get(tool) ?? 0;
          for (let i = 0; i < count - wanted; i++) unexpected.push(tool);
        }
      }

      const pass = missing.length === 0 && unexpected.length === 0;
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing: [${missing.join(", ")}]`);
      if (unexpected.length > 0) {
        parts.push(`unexpected: [${unexpected.join(", ")}]`);
      }

      return {
        score: pass,
        reason: pass
          ? `all expected tools called: [${options.expectedTools.join(", ")}]`
          : parts.join("; "),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// TrajectoryMatch
// ---------------------------------------------------------------------------

/**
 * Options for {@link trajectoryMatch}.
 */
export interface TrajectoryMatchOptions {
  /** Expected ordered list of tool names. */
  expectedTrajectory: string[];
  /**
   * Comparison mode:
   * - `'exact'` — 1.0 iff the sequences are equal, else 0.0.
   * - `'in_order'` — F1 from longest common subsequence (LCS).
   *   Precision = LCS / actual.length, recall = LCS / expected.length.
   * - `'any_order'` — F1 from multiset intersection.
   *   Precision = overlap / actual.length, recall = overlap / expected.length.
   *
   * Default: `'in_order'`.
   */
  order?: "exact" | "in_order" | "any_order";
  /**
   * Whether to include failed tool-call attempts in the trajectory. Default: false.
   */
  includeFailed?: boolean;
  /** Override the evaluator name shown in reports. */
  evaluationName?: string;
}

/** Longest common subsequence length between two arrays. */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** Multiset intersection size between two arrays. */
function multisetIntersectionSize(a: string[], b: string[]): number {
  const freq = new Map<string, number>();
  for (const t of b) freq.set(t, (freq.get(t) ?? 0) + 1);
  let overlap = 0;
  for (const t of a) {
    const rem = freq.get(t) ?? 0;
    if (rem > 0) {
      overlap++;
      freq.set(t, rem - 1);
    }
  }
  return overlap;
}

function f1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Compare the actual ordered tool trajectory to an expected one.
 *
 * Returns a numeric score in [0.0, 1.0].
 *
 * @example
 * ```ts
 * const ev = trajectoryMatch({
 *   expectedTrajectory: ['validate', 'enrich', 'submit'],
 *   order: 'in_order',
 * });
 * ```
 */
export function trajectoryMatch(options: TrajectoryMatchOptions): Evaluator {
  const mode = options.order ?? "in_order";
  return {
    name: options.evaluationName ?? "trajectoryMatch",
    evaluate(ctx: EvaluatorContext): EvalScore {
      const spans = collectToolCallSpans(ctx, options.includeFailed ?? false);
      if (spans === null) {
        return { score: 0, reason: NO_SPAN_TREE_REASON };
      }

      const actual = spans.map((s) => toolNameFromSpan(s) ?? s.name);
      const expected = options.expectedTrajectory;

      // Empty-sequence edge cases
      if (expected.length === 0 && actual.length === 0) {
        return { score: 1, reason: "both expected and actual trajectories are empty" };
      }
      if (expected.length === 0 || actual.length === 0) {
        return {
          score: 0,
          reason: `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        };
      }

      if (mode === "exact") {
        const pass =
          actual.length === expected.length &&
          actual.every((t, i) => t === expected[i]);
        return {
          score: pass ? 1 : 0,
          reason: pass
            ? "exact match"
            : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        };
      }

      if (mode === "in_order") {
        const lcs = lcsLength(actual, expected);
        const precision = lcs / actual.length;
        const recall = lcs / expected.length;
        const score = f1(precision, recall);
        return {
          score,
          reason:
            `LCS=${lcs}, precision=${precision.toFixed(3)}, recall=${recall.toFixed(3)}, F1=${score.toFixed(3)}` +
            ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
        };
      }

      // any_order
      const overlap = multisetIntersectionSize(actual, expected);
      const precision = overlap / actual.length;
      const recall = overlap / expected.length;
      const score = f1(precision, recall);
      return {
        score,
        reason:
          `overlap=${overlap}, precision=${precision.toFixed(3)}, recall=${recall.toFixed(3)}, F1=${score.toFixed(3)}` +
          ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// ArgumentCorrectness
// ---------------------------------------------------------------------------

/**
 * Options for {@link argumentCorrectness}.
 */
export interface ArgumentCorrectnessOptions {
  /** The tool to inspect. */
  toolName: string;
  /** Expected argument keys/values to check. */
  expectedArguments: Record<string, unknown>;
  /**
   * - `'subset'` (default): every expected key/value must be present.
   * - `'exact'`: deep equality — unexpected keys also fail.
   */
  matchMode?: "exact" | "subset";
  /**
   * Which invocation to inspect when the tool is called multiple times.
   * - `'first'` (default): first successful/considered call.
   * - `'last'`: last call.
   * - `number`: zero-based index.
   */
  occurrence?: "first" | "last" | number;
  /**
   * Whether to count failed tool-call attempts. Default: false.
   */
  includeFailed?: boolean;
  /** Override the evaluator name shown in reports. */
  evaluationName?: string;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (
      !Object.prototype.hasOwnProperty.call(b, k) ||
      !deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Check that a specific tool call received particular arguments.
 *
 * @example
 * ```ts
 * const ev = argumentCorrectness({
 *   toolName: 'issue_refund',
 *   expectedArguments: { order_id: '12345' },
 *   matchMode: 'subset',
 *   occurrence: 'first',
 * });
 * ```
 */
export function argumentCorrectness(
  options: ArgumentCorrectnessOptions,
): Evaluator {
  return {
    name: options.evaluationName ?? "argumentCorrectness",
    evaluate(ctx: EvaluatorContext): EvalScore {
      const spans = collectToolCallSpans(ctx, options.includeFailed ?? false);
      if (spans === null) {
        return { score: false, reason: NO_SPAN_TREE_REASON };
      }

      const matching = spans.filter(
        (s) => (toolNameFromSpan(s) ?? s.name) === options.toolName,
      );

      if (matching.length === 0) {
        return {
          score: false,
          reason: `tool '${options.toolName}' was never called`,
        };
      }

      const occurrence = options.occurrence ?? "first";
      let target: SpanNode;
      if (occurrence === "first") {
        target = matching[0];
      } else if (occurrence === "last") {
        target = matching[matching.length - 1];
      } else {
        const idx = occurrence as number;
        if (idx < 0 || idx >= matching.length) {
          return {
            score: false,
            reason: `occurrence index ${idx} is out of range (tool called ${matching.length} time(s))`,
          };
        }
        target = matching[idx];
      }

      const actual = argsFromSpan(target);
      if (actual === undefined) {
        return {
          score: false,
          reason:
            `arguments for '${options.toolName}' are not available (instrumentation may have content recording disabled)`,
        };
      }

      const mode = options.matchMode ?? "subset";

      if (mode === "exact") {
        const pass = deepEqual(actual, options.expectedArguments);
        return {
          score: pass,
          reason: pass
            ? "arguments match exactly"
            : `expected ${JSON.stringify(options.expectedArguments)}, got ${
              JSON.stringify(actual)
            }`,
        };
      }

      // subset: every expected key/value must be in actual
      const mismatches: string[] = [];
      for (const [key, expectedVal] of Object.entries(options.expectedArguments)) {
        if (!Object.prototype.hasOwnProperty.call(actual, key)) {
          mismatches.push(`missing key '${key}'`);
        } else if (!deepEqual(actual[key], expectedVal)) {
          mismatches.push(
            `'${key}': expected ${JSON.stringify(expectedVal)}, got ${
              JSON.stringify(actual[key])
            }`,
          );
        }
      }

      const pass = mismatches.length === 0;
      return {
        score: pass,
        reason: pass ? "all expected arguments present" : mismatches.join("; "),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// MaxToolCalls
// ---------------------------------------------------------------------------

/**
 * Options for {@link maxToolCalls}.
 */
export interface MaxToolCallsOptions {
  /** Maximum allowed locally-executed tool calls. */
  maxCalls: number;
  /**
   * Whether to count tool-call attempts that ended in an error.
   * Default: `true` (failed attempts still consume budget).
   */
  includeFailed?: boolean;
  /** Override the evaluator name shown in reports. */
  evaluationName?: string;
}

/**
 * Assert that the agent stayed within a tool-call budget.
 *
 * @example
 * ```ts
 * const ev = maxToolCalls({ maxCalls: 5 });
 * ```
 */
export function maxToolCalls(options: MaxToolCallsOptions): Evaluator {
  return {
    name: options.evaluationName ?? "maxToolCalls",
    evaluate(ctx: EvaluatorContext): EvalScore {
      const spans = collectToolCallSpans(ctx, options.includeFailed ?? true);
      if (spans === null) {
        return { score: false, reason: NO_SPAN_TREE_REASON };
      }

      const count = spans.length;
      const pass = count <= options.maxCalls;
      return {
        score: pass,
        reason: pass
          ? `${count} tool call(s) within budget of ${options.maxCalls}`
          : `${count} tool call(s) exceeds budget of ${options.maxCalls}`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// MaxModelRequests
// ---------------------------------------------------------------------------

/**
 * Options for {@link maxModelRequests}.
 */
export interface MaxModelRequestsOptions {
  /** Maximum allowed model (LLM) requests. */
  maxRequests: number;
  /** Override the evaluator name shown in reports. */
  evaluationName?: string;
}

/**
 * Assert that the agent stayed within a model-request budget.
 *
 * Prefers `ctx.usage.requests` when available; otherwise counts model request
 * spans (spans whose name starts with `"ai.generateText"` or `"ai.streamText"`).
 *
 * @example
 * ```ts
 * const ev = maxModelRequests({ maxRequests: 3 });
 * ```
 */
export function maxModelRequests(options: MaxModelRequestsOptions): Evaluator {
  return {
    name: options.evaluationName ?? "maxModelRequests",
    evaluate(ctx: EvaluatorContext): EvalScore {
      // Prefer explicit usage.requests if available on the context.
      const usageRequests = (ctx.usage as (typeof ctx.usage & { requests?: number }) | undefined)
        ?.requests;
      let count: number;

      if (typeof usageRequests === "number") {
        count = usageRequests;
      } else if (ctx.spanTree) {
        count = 0;
        for (const node of ctx.spanTree) {
          if (isModelRequestSpan(node)) count++;
        }
      } else {
        return { score: false, reason: NO_SPAN_TREE_REASON };
      }

      const pass = count <= options.maxRequests;
      return {
        score: pass,
        reason: pass
          ? `${count} model request(s) within budget of ${options.maxRequests}`
          : `${count} model request(s) exceeds budget of ${options.maxRequests}`,
      };
    },
  };
}
