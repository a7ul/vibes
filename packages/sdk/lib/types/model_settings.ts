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
}
