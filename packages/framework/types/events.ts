import type { Usage } from "../types.ts";

// ---------------------------------------------------------------------------
// AgentStreamEvent — discriminated union of all events emitted by
// agent.runStreamEvents().
// ---------------------------------------------------------------------------

/**
 * Typed events emitted by `agent.runStreamEvents()`.
 *
 * Consumers iterate over an `AsyncIterable<AgentStreamEvent<TOutput>>` and
 * switch on `event.kind` to handle each event type.
 */
export type AgentStreamEvent<TOutput = string> =
  /** Fired at the start of every model turn (turn numbering starts at 0). */
  | { kind: "turn-start"; turn: number }
  /** A text token delta arrived from the model. */
  | { kind: "text-delta"; delta: string }
  /** The model requested a tool call (args may still be streaming). */
  | {
    kind: "tool-call-start";
    toolName: string;
    toolCallId: string;
    args: Record<string, unknown>;
  }
  /** A tool call finished and returned its result. */
  | {
    kind: "tool-call-result";
    toolCallId: string;
    toolName: string;
    result: unknown;
  }
  /**
   * Best-effort partial structured output — emitted progressively as
   * `final_result` tool args stream in. Only emitted in `'tool'` output mode
   * and only when the accumulated args parse successfully.
   */
  | { kind: "partial-output"; partial: unknown }
  /** The run completed successfully. */
  | { kind: "final-result"; output: TOutput }
  /** Token usage snapshot (emitted once per model turn, after it completes). */
  | { kind: "usage-update"; usage: Usage }
  /** An error occurred; the stream will not yield further events. */
  | { kind: "error"; error: unknown };
