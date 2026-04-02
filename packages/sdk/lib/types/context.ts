import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";

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

/** Creates a zeroed-out {@link Usage} object to accumulate token counts across turns. */
export function createUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
}

// ---------------------------------------------------------------------------
// RunContext
// ---------------------------------------------------------------------------

export interface RunContext<TDeps = undefined> {
  /**
   * The agent running this context.
   *
   * Set by the framework on every agent run. May be `undefined` in manually
   * constructed contexts used for isolated toolset/tool unit tests.
   */
  // deno-lint-ignore no-explicit-any
  agent?: Agent<TDeps, any>;
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

// Re-export ModelMessage for convenience (used by results.ts)
export type { ModelMessage };
