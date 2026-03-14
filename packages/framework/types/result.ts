import type { ModelMessage } from "ai";
import type { Usage } from "./usage.ts";
import type { RunContext } from "./run_context.ts";

export interface RunResult<TOutput> {
  /** The typed output from the agent. */
  output: TOutput;
  /** Full message history for this run (can be passed back in as messageHistory). */
  messages: ModelMessage[];
  /** Cumulative token usage across all turns. */
  usage: Usage;
  /** Number of result retries that occurred. */
  retryCount: number;
  /** Unique identifier for this run. */
  runId: string;
}

export interface StreamResult<TOutput> {
  /** Async iterable of text deltas as they stream in. */
  textStream: AsyncIterable<string>;
  /** Resolves to the final typed output once the run completes. */
  output: Promise<TOutput>;
  /** Resolves to the full message history once the run completes. */
  messages: Promise<ModelMessage[]>;
  /** Resolves to cumulative token usage once the run completes. */
  usage: Promise<Usage>;
}

/**
 * A result validator receives the run context and the parsed output.
 * Return the (optionally modified) output to accept it, or throw an Error to reject it.
 * Thrown errors are fed back to the model as retry instructions.
 */
export type ResultValidator<TDeps, TOutput> = (
  ctx: RunContext<TDeps>,
  output: TOutput,
) => TOutput | Promise<TOutput>;
