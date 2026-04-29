/**
 * Cross-provider service tier for model requests.
 *
 * - `'auto'`: Let the provider decide — typically uses a higher tier when available,
 *   otherwise standard.
 * - `'default'`: Explicitly request the provider's standard tier.
 * - `'flex'`: Lower-cost, latency-tolerant tier where the provider offers one.
 * - `'priority'`: Higher-priority / lower-latency tier where the provider offers one.
 *
 * Not all providers support all values. Unsupported values are silently ignored.
 * Equivalent to Pydantic AI's `ServiceTier` setting (added in v1.88.0).
 */
export type ServiceTier = "auto" | "default" | "flex" | "priority";

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
   * Cross-provider service tier for the request.
   * See {@link ServiceTier} for value semantics.
   *
   * Because the AI SDK does not expose a unified `serviceTier` parameter at the
   * `generateText`/`streamText` level, this field is **not** automatically mapped
   * to the underlying API call. Use `providerOptions` to pass the service tier for
   * your specific provider (e.g. `{ openai: { serviceTier: 'flex' } }`), or
   * configure it on the model constructor. This field is provided for documentation
   * and type-checking purposes.
   *
   * Equivalent to Pydantic AI's `ModelSettings.service_tier` (added in v1.88.0).
   */
  serviceTier?: ServiceTier;
  /**
   * Provider-specific options passed through to the AI SDK's `generateText` /
   * `streamText` as `providerOptions`. Use this to configure provider-specific
   * features such as service tier, caching, or other settings not covered by
   * the standard `ModelSettings` fields.
   *
   * The outer key is the provider name (e.g. `'openai'`, `'anthropic'`); the
   * inner object is the provider-specific options record.
   *
   * @example
   * ```ts
   * // Set OpenAI service tier
   * const agent = new Agent({
   *   model: openai('gpt-4o'),
   *   modelSettings: {
   *     providerOptions: { openai: { serviceTier: 'flex' } },
   *   },
   * });
   * ```
   */
  providerOptions?: Record<string, Record<string, unknown>>;
}
