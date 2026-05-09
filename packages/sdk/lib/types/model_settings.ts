/**
 * Controls which function tools the model can use.
 *
 * - `'auto'` (default): The model decides whether to use tools.
 * - `'none'`: Disables function tools. When using tool-mode structured output,
 *   the `final_result` tool and any user-defined output tools remain available
 *   so the agent can still return a structured result.
 * - `'required'`: Forces the model to call a function tool.
 * - `string[]`: Restricts function tools to the listed names. Output tools
 *   (`final_result` and `isOutput` tools) are always kept.
 *
 * Equivalent to Pydantic AI's `tool_choice` in `ModelSettings`.
 */
export type ToolChoice = "auto" | "none" | "required" | string[];

/**
 * Model-specific settings passed through to the AI SDK's generateText/streamText.
 * These map directly to top-level options of those functions.
 */
export interface ModelSettings {
  /** Sampling temperature (0–2). Lower = more deterministic. */
  temperature?: number;
  /** Maximum number of tokens to generate. */
  maxTokens?: number;
  /** Nucleus sampling: only sample from the top-P probability mass. */
  topP?: number;
  /** Only sample from the top-K tokens. */
  topK?: number;
  /** Penalises tokens that have already appeared (frequency). */
  frequencyPenalty?: number;
  /** Penalises tokens regardless of frequency (presence). */
  presencePenalty?: number;
  /** Stop generation when any of these sequences appear. */
  stopSequences?: string[];
  /** Seed for deterministic generation (model-dependent). */
  seed?: number;
  /**
   * Controls which function tools the model can use.
   *
   * See {@link ToolChoice} for the full documentation.
   *
   * Equivalent to Pydantic AI's `tool_choice` in `ModelSettings`.
   */
  toolChoice?: ToolChoice;
}
