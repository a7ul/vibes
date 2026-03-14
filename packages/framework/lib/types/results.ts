import type { ModelMessage } from "ai";
import type { RunContext, Usage } from "./context.ts";

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * A result validator receives the run context and the parsed output.
 * Return the (optionally modified) output to accept it, or throw to reject and retry.
 */
export type ResultValidator<TDeps, TOutput> = (
  ctx: RunContext<TDeps>,
  output: TOutput,
) => TOutput | Promise<TOutput>;

export interface RunResult<TOutput> {
  /** The typed output from the agent. */
  output: TOutput;
  /** Full message history for this run (can be passed back in as messageHistory). */
  messages: ModelMessage[];
  /** Messages added during this run only (excludes the passed-in messageHistory). */
  newMessages: ModelMessage[];
  /** Cumulative token usage across all turns. */
  usage: Usage;
  /** Number of result retries that occurred. */
  retryCount: number;
  /** Unique identifier for this run. */
  runId: string;
  /** Metadata attached by tools during the run, keyed by tool call ID. */
  toolMetadata: Map<string, Record<string, unknown>>;
}

export interface StreamResult<TOutput> {
  /** Async iterable of text deltas as they stream in. */
  textStream: AsyncIterable<string>;
  /** Resolves to the final typed output once the run completes. */
  output: Promise<TOutput>;
  /** Resolves to the full message history once the run completes. */
  messages: Promise<ModelMessage[]>;
  /** Resolves to messages added during this run only (excludes passed-in history). */
  newMessages: Promise<ModelMessage[]>;
  /** Resolves to cumulative token usage once the run completes. */
  usage: Promise<Usage>;
  /**
   * Async iterable of partial output objects emitted progressively as the
   * `final_result` tool args stream in. Emits only when Zod parse succeeds
   * (best-effort). Only populated when `outputMode` is `'tool'`.
   */
  partialOutput: AsyncIterable<TOutput>;
}
