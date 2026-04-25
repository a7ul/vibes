import type { Usage } from "./context.ts";
import type { RunContext } from "./context.ts";

// ---------------------------------------------------------------------------
// AgentStreamEvent - discriminated union of all events emitted by
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
   * Best-effort partial structured output - emitted progressively as
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

// ---------------------------------------------------------------------------
// EventStreamHandler - observer / processor for runStreamEvents()
// ---------------------------------------------------------------------------

/**
 * A function that observes or transforms the event stream emitted by
 * `agent.runStreamEvents()`. Two calling conventions are supported:
 *
 * - **Observer form** (`async (ctx, stream) => void`): Receives all events for
 *   side effects (logging, monitoring, etc.) while events pass through
 *   unchanged to downstream consumers.
 * - **Processor form** (`async function*(ctx, stream) { yield ... }`): An async
 *   generator that can add, remove, or modify events. The events it yields
 *   replace the inner stream for downstream consumers.
 *
 * The form is detected at runtime: if the return value has
 * `[Symbol.asyncIterator]`, it is treated as a processor; otherwise it is
 * treated as an observer.
 *
 * Equivalent to pydantic-ai's `ProcessEventStream` capability.
 *
 * @example
 * ```ts
 * // Observer: log every event (events pass through unchanged)
 * const agent = new Agent({
 *   model,
 *   eventStreamHandler: async (ctx, stream) => {
 *     for await (const event of stream) {
 *       console.log(event.kind);
 *     }
 *   },
 * });
 *
 * // Processor: filter out partial-output events
 * const agent = new Agent({
 *   model,
 *   eventStreamHandler: async function*(ctx, stream) {
 *     for await (const event of stream) {
 *       if (event.kind !== "partial-output") yield event;
 *     }
 *   },
 * });
 * ```
 */
export type EventStreamHandler<TDeps, TOutput> = (
  ctx: RunContext<TDeps>,
  stream: AsyncIterable<AgentStreamEvent<TOutput>>,
) =>
  | AsyncIterable<AgentStreamEvent<TOutput>>
  | Promise<void>
  | void;
