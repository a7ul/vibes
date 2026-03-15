/**
 * Dataset generation using LLM.
 *
 * Uses an Agent with structured output to generate test cases automatically.
 */

import type { LanguageModel } from "ai";
import type { ZodType } from "zod";
import { z } from "zod";
import { Agent } from "../agent.ts";
import { Dataset } from "./dataset.ts";
import type { Case } from "./types.ts";

// ---------------------------------------------------------------------------
// GenerateDatasetOptions
// ---------------------------------------------------------------------------

export interface GenerateDatasetOptions<TInput, TExpected> {
  /** The LanguageModel to use for generation. */
  model?: LanguageModel;
  /** Number of examples to generate. Default: 10. */
  nExamples?: number;
  /** Additional instructions to guide generation. */
  extraInstructions?: string;
  /** Zod schema for the input type. Used to define the generation schema. */
  inputSchema: ZodType<TInput>;
  /** Zod schema for the expected output type. Optional. */
  expectedOutputSchema?: ZodType<TExpected>;
  /** Zod schema for the metadata type. Optional. */
  metadataSchema?: ZodType;
}

// ---------------------------------------------------------------------------
// generateDataset
// ---------------------------------------------------------------------------

/**
 * Generate a Dataset of test cases using an LLM.
 *
 * The LLM will generate `nExamples` cases that conform to the provided schemas.
 *
 * @example
 * ```ts
 * const ds = await generateDataset({
 *   model: openai("gpt-4o"),
 *   nExamples: 5,
 *   inputSchema: z.object({ question: z.string() }),
 *   expectedOutputSchema: z.string(),
 *   extraInstructions: "Generate geography trivia questions.",
 * });
 * ```
 */
export async function generateDataset<TInput, TExpected>(
  options: GenerateDatasetOptions<TInput, TExpected>,
): Promise<Dataset<TInput, TExpected>> {
  const nExamples = options.nExamples ?? 10;

  if (options.model === undefined) {
    throw new Error(
      "A model is required for generateDataset. Pass a model in GenerateDatasetOptions.",
    );
  }

  // Build the output schema: an array of cases
  const caseSchema = buildCaseSchema(options);
  const outputSchema = z.object({
    cases: z.array(caseSchema).describe(
      `Array of ${nExamples} test cases`,
    ),
  });

  // Build the generation prompt
  const prompt = buildGenerationPrompt(nExamples, options);

  const agent = new Agent({
    model: options.model,
    systemPrompt:
      "You are a dataset generation assistant. Generate diverse, realistic test cases " +
      "that cover a range of scenarios including edge cases.",
    outputSchema,
  });

  const result = await agent.run(prompt);
  const generated = result.output as {
    cases: Array<{
      name?: string;
      inputs: TInput;
      expectedOutput?: TExpected;
      metadata?: Record<string, unknown>;
    }>;
  };

  const cases: Case<TInput, TExpected>[] = generated.cases.map((c, i) => ({
    name: c.name ?? `generated-${i + 1}`,
    inputs: c.inputs,
    expectedOutput: c.expectedOutput,
    metadata: c.metadata,
  }));

  return Dataset.fromArray<TInput, TExpected>(cases);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildCaseSchema<TInput, TExpected>(
  options: GenerateDatasetOptions<TInput, TExpected>,
  // deno-lint-ignore no-explicit-any
): z.ZodObject<any> {
  const shape: Record<string, ZodType> = {
    name: z.string().optional().describe("A short descriptive name for this test case"),
    inputs: options.inputSchema.describe("The input for this test case"),
  };

  if (options.expectedOutputSchema !== undefined) {
    shape["expectedOutput"] = options.expectedOutputSchema.optional().describe(
      "The expected output for this test case",
    );
  }

  if (options.metadataSchema !== undefined) {
    shape["metadata"] = options.metadataSchema.optional().describe(
      "Optional metadata for this test case",
    );
  }

  return z.object(shape);
}

function buildGenerationPrompt<TInput, TExpected>(
  nExamples: number,
  options: GenerateDatasetOptions<TInput, TExpected>,
): string {
  const parts: string[] = [
    `Generate exactly ${nExamples} diverse test cases.`,
    "",
    "Requirements:",
    "- Cover a range of scenarios (typical cases, edge cases, boundary conditions)",
    "- Each case should be distinct and test different aspects",
  ];

  if (options.extraInstructions !== undefined) {
    parts.push("", "Additional instructions:", options.extraInstructions);
  }

  return parts.join("\n");
}
