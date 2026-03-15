/**
 * FunctionModel - a custom-function-driven language model for testing.
 *
 * Lets you control exactly what the model responds with on each turn.
 * The function receives the current messages, available tools, and turn number,
 * and returns the full generate result.
 *
 * @example
 * ```ts
 * const responses = mockValues(
 *   toolCallResponse("search", { query: "hello" }),
 *   textResponse("The answer is 42"),
 * );
 * const model = new FunctionModel(() => Promise.resolve(responses()));
 * const result = await agent.override({ model }).run("Hello");
 * ```
 */

import type { MockLanguageModelV3 } from "ai/test";

// ---------------------------------------------------------------------------
// Types derived from MockLanguageModelV3 to stay version-compatible
// ---------------------------------------------------------------------------

/** The generate result shape, derived from MockLanguageModelV3. */
export type DoGenerateResult = Awaited<
  ReturnType<MockLanguageModelV3["doGenerate"]>
>;

/** doGenerate parameters shape, derived from MockLanguageModelV3. */
type DoGenerateParams = Parameters<MockLanguageModelV3["doGenerate"]>[0];

/** The prompt (message history) sent to the model. */
type ModelPrompt = DoGenerateParams["prompt"];

/** A single tool entry from the doGenerate call. */
type ToolEntry = NonNullable<DoGenerateParams["tools"]>[number];

/** A function-type tool (as opposed to provider-defined tools). */
type FunctionTool = Extract<ToolEntry, { type: "function" }>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Parameters passed to the ModelFunction on each turn. */
export interface ModelFunctionParams {
  /** The full prompt (message history) sent to the model on this turn. */
  messages: ModelPrompt;
  /** Function tools available to the model on this turn. */
  tools: FunctionTool[];
  /** Zero-based turn counter. Increments with each doGenerate call. */
  turn: number;
}

/**
 * A function that controls what the model responds with.
 * Receives current messages, tools, and turn number.
 * Returns a DoGenerateResult (or a Promise thereof).
 */
export type ModelFunction = (
  params: ModelFunctionParams,
) => DoGenerateResult | Promise<DoGenerateResult>;

// ---------------------------------------------------------------------------
// FunctionModel
// ---------------------------------------------------------------------------

export class FunctionModel {
  readonly specificationVersion = "v3" as const;
  readonly provider = "function-model";
  readonly modelId = "function-model";
  readonly supportedUrls: Record<string, RegExp[]> = {};

  private readonly _fn: ModelFunction;
  private _turn: number;

  constructor(fn: ModelFunction) {
    this._fn = fn;
    this._turn = 0;
  }

  doGenerate(options: DoGenerateParams): Promise<DoGenerateResult> {
    const currentTurn = this._turn;
    this._turn += 1;

    const allTools = (options.tools ?? []) as ToolEntry[];
    const functionTools = allTools.filter(
      (t: ToolEntry): t is FunctionTool => t.type === "function",
    );

    return Promise.resolve(
      this._fn({
        messages: options.prompt,
        tools: functionTools,
        turn: currentTurn,
      }),
    );
  }

  doStream(
    options: DoGenerateParams,
  ): Promise<Awaited<ReturnType<MockLanguageModelV3["doStream"]>>> {
    return this.doGenerate(options).then((result) => {
      const chunks: unknown[] = [];

      for (const part of result.content) {
        if (part.type === "text") {
          chunks.push({
            type: "text-delta" as const,
            id: "text-1",
            delta: part.text,
          });
        } else if (part.type === "tool-call") {
          chunks.push({
            type: "tool-call" as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
        }
      }

      chunks.push({
        type: "finish" as const,
        finishReason: result.finishReason,
        usage: result.usage,
      });

      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      return { stream };
    });
  }
}
