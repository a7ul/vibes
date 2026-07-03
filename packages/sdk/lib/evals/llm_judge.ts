/**
 * LLM-as-judge evaluators for the Vibes evaluation framework.
 *
 * Uses an Agent with a structured Zod output schema to have an LLM evaluate
 * task outputs against a rubric.
 *
 * Note: Unlike the Python version, `setEvalAttribute`/`incrementEvalMetric`
 * are not standalone functions - use `ctx.setEvalAttribute()` instead.
 */

import type { LanguageModel } from "ai";
import { z } from "zod";
import { Agent } from "../agent.ts";
import type { EvalScore, Evaluator } from "./types.ts";
import type { EvaluatorContext } from "./context.ts";

// ---------------------------------------------------------------------------
// Default model
// ---------------------------------------------------------------------------

let _defaultJudgeModel: LanguageModel | undefined;

/**
 * Set the default LanguageModel used by `judgeOutput`, `judgeInputOutput`,
 * and other judge helpers when no explicit model is provided.
 */
export function setDefaultJudgeModel(model: LanguageModel): void {
  _defaultJudgeModel = model;
}

// ---------------------------------------------------------------------------
// Judge output schema
// ---------------------------------------------------------------------------

const JudgeOutputSchema = z.object({
  score: z.number().min(0).max(1).describe(
    "A score between 0 and 1 indicating how well the output satisfies the rubric. 1 = fully satisfies, 0 = does not satisfy at all.",
  ),
  reason: z.string().describe(
    "A brief explanation of the score and any issues found.",
  ),
});

type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

// ---------------------------------------------------------------------------
// LLMJudgeOptions
// ---------------------------------------------------------------------------

export interface LLMJudgeOptions {
  /**
   * The evaluation rubric. Describe what makes a good output.
   * The judge will score the output against this rubric.
   */
  rubric: string;
  /**
   * The LanguageModel to use for judging. Falls back to the default judge model
   * set via `setDefaultJudgeModel()`.
   */
  model?: LanguageModel;
  /**
   * Whether to include the task input in the judge's context.
   * Default: false.
   */
  includeInput?: boolean;
  /**
   * Whether to include the expected output in the judge's context.
   * Default: false.
   */
  includeExpectedOutput?: boolean;
  /**
   * If true, the evaluator returns the raw numeric score (0-1) instead of
   * converting to boolean. Default: false (boolean).
   */
  score?: boolean;
}

// ---------------------------------------------------------------------------
// llmJudge factory
// ---------------------------------------------------------------------------

/**
 * Creates an Evaluator that uses an LLM to judge the task output against a rubric.
 *
 * By default returns a boolean score (pass/fail based on whether score >= 0.5).
 * Set `score: true` to return the raw 0-1 numeric score.
 *
 * @example
 * ```ts
 * const ev = llmJudge({
 *   rubric: "Is the response helpful and accurate?",
 *   model: openai("gpt-4o"),
 * });
 * ```
 */
export function llmJudge(options: LLMJudgeOptions): Evaluator {
  return {
    name: "llmJudge",
    async evaluate(ctx: EvaluatorContext): Promise<EvalScore> {
      const result = await _runJudge({
        output: ctx.output,
        input: options.includeInput ? ctx.inputs : undefined,
        expected: options.includeExpectedOutput
          ? ctx.expectedOutput
          : undefined,
        rubric: options.rubric,
        model: options.model,
      });

      const numericScore = result.score;
      const finalScore = options.score ? numericScore : numericScore >= 0.5;

      return {
        score: finalScore,
        reason: result.reason,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Judge a single output against a rubric.
 *
 * Returns a boolean score (pass if LLM score >= 0.5).
 */
export async function judgeOutput(
  output: unknown,
  rubric: string,
  model?: LanguageModel,
): Promise<EvalScore> {
  const result = await _runJudge({ output, rubric, model });
  return {
    score: result.score >= 0.5,
    reason: result.reason,
  };
}

/**
 * Judge an output in context of the input against a rubric.
 */
export async function judgeInputOutput(
  input: unknown,
  output: unknown,
  rubric: string,
  model?: LanguageModel,
): Promise<EvalScore> {
  const result = await _runJudge({ output, input, rubric, model });
  return {
    score: result.score >= 0.5,
    reason: result.reason,
  };
}

/**
 * Judge an output compared to an expected output against a rubric.
 */
export async function judgeOutputExpected(
  output: unknown,
  expected: unknown,
  rubric: string,
  model?: LanguageModel,
): Promise<EvalScore> {
  const result = await _runJudge({ output, expected, rubric, model });
  return {
    score: result.score >= 0.5,
    reason: result.reason,
  };
}

/**
 * Judge an output in context of the input, compared to an expected output.
 */
export async function judgeInputOutputExpected(
  input: unknown,
  output: unknown,
  expected: unknown,
  rubric: string,
  model?: LanguageModel,
): Promise<EvalScore> {
  const result = await _runJudge({ output, input, expected, rubric, model });
  return {
    score: result.score >= 0.5,
    reason: result.reason,
  };
}

// ---------------------------------------------------------------------------
// Internal: _runJudge
// ---------------------------------------------------------------------------

interface JudgeRunOptions {
  output: unknown;
  input?: unknown;
  expected?: unknown;
  rubric: string;
  model?: LanguageModel;
}

// ---------------------------------------------------------------------------
// GEval
// ---------------------------------------------------------------------------

/**
 * Options for the `gEval` evaluator.
 */
export interface GEvalOptions {
  /**
   * The quality aspect being evaluated (e.g. "coherence", "fluency", "relevance").
   * Used in the evaluator name and included in the prompt.
   */
  criteria: string;
  /**
   * Explicit chain-of-thought steps the judge should follow before scoring.
   * At least one step is required.
   */
  evaluationSteps: string[];
  /**
   * Inclusive integer range for the score returned by the judge.
   * Default: [1, 5].
   */
  scoreRange?: [min: number, max: number];
  /**
   * The LanguageModel to use for judging. Falls back to the default judge model
   * set via `setDefaultJudgeModel()`.
   */
  model?: LanguageModel;
  /**
   * Whether to include the task input in the judge's context. Default: false.
   */
  includeInput?: boolean;
  /**
   * Whether to include the expected output in the judge's context. Default: false.
   */
  includeExpectedOutput?: boolean;
}

/**
 * G-Eval: chain-of-thought scoring evaluator (Liu et al., 2023).
 *
 * The judge follows explicit `evaluationSteps` you provide, then returns an
 * integer score within `scoreRange` (default 1–5) plus a reasoning trace.
 *
 * Unlike `llmJudge`, the returned score is the raw integer from `scoreRange`,
 * **not** normalized to `[0, 1]`.
 *
 * @example
 * ```ts
 * const ev = gEval({
 *   criteria: "coherence",
 *   evaluationSteps: [
 *     "Read the output carefully.",
 *     "Check that each sentence follows logically from the previous one.",
 *     "Assign a score from 1 (incoherent) to 5 (fully coherent).",
 *   ],
 *   includeInput: true,
 * });
 * ```
 */
export function gEval(options: GEvalOptions): Evaluator {
  const [minScore, maxScore] = options.scoreRange ?? [1, 5];
  if (minScore >= maxScore) {
    throw new Error(
      `gEval: scoreRange min (${minScore}) must be less than max (${maxScore})`,
    );
  }
  if (options.evaluationSteps.length === 0) {
    throw new Error("gEval: evaluationSteps must not be empty");
  }

  const GEvalOutputSchema = z.object({
    reasoning: z.string().describe(
      "Step-by-step reasoning following the evaluation steps.",
    ),
    score: z
      .number()
      .int()
      .min(minScore)
      .max(maxScore)
      .describe(
        `Integer score in the range [${minScore}, ${maxScore}] for the given criteria.`,
      ),
  });
  type GEvalOutput = z.infer<typeof GEvalOutputSchema>;

  return {
    name: `gEval:${options.criteria}`,
    async evaluate(ctx: EvaluatorContext): Promise<EvalScore> {
      const model = options.model ?? _defaultJudgeModel;
      if (model === undefined) {
        throw new Error(
          "No LLM model provided for gEval. " +
            "Pass a model in GEvalOptions or call setDefaultJudgeModel().",
        );
      }

      const parts: string[] = [];
      parts.push(
        `You are evaluating the following aspect: **${options.criteria}**.`,
      );
      parts.push("");
      parts.push("## Evaluation Steps");
      options.evaluationSteps.forEach((step, i) => {
        parts.push(`${i + 1}. ${step}`);
      });

      if (options.includeInput && ctx.inputs !== undefined) {
        parts.push(
          `\n## Input\n${JSON.stringify(ctx.inputs, null, 2)}`,
        );
      }

      parts.push(
        `\n## Output to Evaluate\n${JSON.stringify(ctx.output, null, 2)}`,
      );

      if (options.includeExpectedOutput && ctx.expectedOutput !== undefined) {
        parts.push(
          `\n## Expected Output\n${JSON.stringify(ctx.expectedOutput, null, 2)}`,
        );
      }

      parts.push(
        `\nFollow the evaluation steps above and return your reasoning plus an integer score from ${minScore} to ${maxScore}.`,
      );

      const prompt = parts.join("\n");

      const agent = new Agent<undefined, GEvalOutput>({
        model,
        systemPrompt:
          "You are an expert evaluator. Follow the provided evaluation steps strictly.",
        outputSchema: GEvalOutputSchema,
      });

      const result = await agent.run(prompt);
      const { score, reasoning } = result.output;

      return { score, reason: reasoning };
    },
  };
}

// ---------------------------------------------------------------------------
// _runJudge (internal)
// ---------------------------------------------------------------------------

async function _runJudge(options: JudgeRunOptions): Promise<JudgeOutput> {
  const model = options.model ?? _defaultJudgeModel;
  if (model === undefined) {
    throw new Error(
      "No LLM model provided for llmJudge. " +
        "Pass a model in LLMJudgeOptions or call setDefaultJudgeModel().",
    );
  }

  // Build the prompt
  const parts: string[] = [];

  parts.push("You are an impartial evaluator. Score the following output.");
  parts.push("");
  parts.push(`## Rubric\n${options.rubric}`);

  if (options.input !== undefined) {
    parts.push(`\n## Input\n${JSON.stringify(options.input, null, 2)}`);
  }

  parts.push(`\n## Output to Evaluate\n${JSON.stringify(options.output, null, 2)}`);

  if (options.expected !== undefined) {
    parts.push(
      `\n## Expected Output\n${JSON.stringify(options.expected, null, 2)}`,
    );
  }

  parts.push(
    "\nProvide a score from 0 to 1 (where 1 = fully satisfies the rubric) and a brief reason.",
  );

  const prompt = parts.join("\n");

  const agent = new Agent<undefined, JudgeOutput>({
    model,
    systemPrompt:
      "You are an expert evaluator. Score outputs against the provided rubric objectively.",
    outputSchema: JudgeOutputSchema,
  });

  const result = await agent.run(prompt);
  return result.output;
}
