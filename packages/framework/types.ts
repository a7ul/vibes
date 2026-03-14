import type { ModelMessage } from "ai";

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

/** Token usage accumulated across all turns in a run. */
export interface Usage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	requests: number;
}

export function createUsage(): Usage {
	return { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
}

// ---------------------------------------------------------------------------
// RunContext
// ---------------------------------------------------------------------------

export interface RunContext<TDeps = undefined> {
	/** User-supplied dependencies, injected at run time. */
	deps: TDeps;
	/** Cumulative token usage for this run so far. */
	usage: Usage;
	/** How many times the current result has been retried. */
	retryCount: number;
	/** Name of the tool currently executing, or null outside a tool call. */
	toolName: string | null;
	/** Unique identifier for this run. */
	runId: string;
	/** Per-run metadata supplied by the caller. */
	metadata: Record<string, unknown>;
	/**
	 * Metadata attached by tools after execution, keyed by tool call ID.
	 * Tools call `attachMetadata(toolCallId, meta)` to populate this map.
	 */
	toolResultMetadata: Map<string, Record<string, unknown>>;
	/**
	 * Attach arbitrary metadata for a specific tool call. Tools invoke this
	 * inside their `execute` function to expose extra data to callers.
	 */
	attachMetadata(toolCallId: string, meta: Record<string, unknown>): void;
}

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
}
