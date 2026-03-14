import type { ModelMessage } from "ai";

// ---------------------------------------------------------------------------
// Deferred tool request / result types
// ---------------------------------------------------------------------------

/**
 * A single pending tool call that requires human approval before execution.
 */
export type DeferredToolRequest = {
  /** The AI SDK tool call ID, used to correlate with results. */
  toolCallId: string;
  /** The name of the tool that was called. */
  toolName: string;
  /** The arguments the model passed to the tool. */
  args: Record<string, unknown>;
};

/**
 * A human-supplied result for a deferred tool call.
 *
 * Exactly one of `result` or `argsOverride` should be provided:
 * - `result`: Inject this value directly as the tool's result.
 * - `argsOverride`: Re-execute the tool with these arguments instead of the
 *   original ones. The tool's `execute` function is called again with the
 *   overridden args.
 */
export type DeferredToolResult = {
  /** The tool call ID to resolve (must match a `DeferredToolRequest.toolCallId`). */
  toolCallId: string;
  /** The approved result to inject as the tool's output. */
  result?: string | object;
  /**
   * When provided, re-execute the tool with these args instead of using
   * `result`. The tool's `execute` function is called with the override args.
   */
  argsOverride?: Record<string, unknown>;
};

/**
 * A collection of deferred tool results supplied by the caller to resume a
 * paused run.
 */
export type DeferredToolResults = {
  results: DeferredToolResult[];
};

// ---------------------------------------------------------------------------
// Resume state - internal, opaque to callers
// ---------------------------------------------------------------------------

/**
 * Internal state needed to resume a run after human approval.
 * Callers should treat this as opaque and pass it back unchanged.
 */
export type ResumeState = {
  /** Full message history up to the point where approval was required. */
  messages: ModelMessage[];
  /** The number of turns consumed so far (so maxTurns accounting is correct). */
  turnCount: number;
};

// ---------------------------------------------------------------------------
// DeferredToolRequests - returned to callers when approval is needed
// ---------------------------------------------------------------------------

/**
 * Returned by `agent.run()` (via `ApprovalRequiredError`) when one or more
 * tool calls require human approval before execution.
 *
 * The caller should inspect `requests`, optionally modify args, then call
 * `agent.resume(deferred, results)` to continue the run.
 */
export class DeferredToolRequests {
  /** The pending tool calls awaiting human approval. */
  readonly requests: DeferredToolRequest[];

  /**
   * Internal resume state. Opaque - pass back to `agent.resume()` unchanged.
   * @internal
   */
  readonly _resumeState: ResumeState;

  constructor(requests: DeferredToolRequest[], resumeState: ResumeState) {
    this.requests = requests;
    this._resumeState = resumeState;
  }
}
