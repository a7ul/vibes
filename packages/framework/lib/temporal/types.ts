/**
 * Types for the Temporal durable execution integration.
 *
 * These types are framework-agnostic and can be used both from Deno (for type
 * checking and building activity/workflow registrations) and from Node.js (where
 * the actual Temporal worker and workflow runtime live).
 */

import type { ModelMessage } from "ai";
import type { RunResult } from "../types/results.ts";

// ---------------------------------------------------------------------------
// Activity options
// ---------------------------------------------------------------------------

/** Configuration for a single Temporal activity. */
export interface TemporalActivityOptions {
  /**
   * Maximum time the activity may run from start to close (including retries).
   * Format: "30s", "5m", "1h".
   */
  startToCloseTimeout?: string;
  /** Retry policy for this activity. */
  retryPolicy?: {
    /** Maximum number of attempts (including the first). */
    maximumAttempts?: number;
    /**
     * Initial backoff interval between retries.
     * Format: "1s", "500ms".
     */
    initialInterval?: string;
    /** Multiplier applied to the interval after each retry. */
    backoffCoefficient?: number;
  };
}

// ---------------------------------------------------------------------------
// Agent-level options
// ---------------------------------------------------------------------------

/** Configuration for a {@link TemporalAgent}. */
export interface TemporalAgentOptions<TDeps> {
  /**
   * Temporal task queue this agent's activities and workflow will be
   * registered on.
   */
  taskQueue: string;
  /** Activity options for model-call activities. */
  modelCallActivity?: TemporalActivityOptions;
  /** Activity options for tool-call activities. */
  toolCallActivity?: TemporalActivityOptions;
  /**
   * Factory that creates the `deps` object inside the Temporal worker
   * process. Dependencies typically cannot be serialized across the
   * workflow/activity boundary, so they must be re-created on the worker.
   */
  depsFactory?: () => TDeps | Promise<TDeps>;
}

// ---------------------------------------------------------------------------
// Serializable run options (workflow-safe subset of RunOptions)
// ---------------------------------------------------------------------------

/**
 * Subset of {@link RunOptions} that can be serialized and passed across the
 * Temporal workflow/activity boundary (no functions, no non-serializable types).
 */
export interface SerializableRunOptions {
  /** Serialized message history (JSON-safe). */
  messageHistory?: SerializableMessage[];
  /** Per-run metadata. Must be JSON-serializable. */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Serializable message format
// ---------------------------------------------------------------------------

/**
 * A JSON-serializable representation of a {@link ModelMessage}.
 *
 * `ModelMessage` from the AI SDK is already JSON-serializable; this type
 * makes the contract explicit for Temporal payloads.
 */
export interface SerializableMessage {
  role: string;
  content: string | unknown[];
}

// ---------------------------------------------------------------------------
// Activity parameter / result shapes
// ---------------------------------------------------------------------------

/** Parameters passed to the `runModelTurn` activity. */
export interface ModelTurnParams {
  /** Serialized conversation history so far. */
  messages: SerializableMessage[];
  /** The user prompt for this turn (only set on the first turn). */
  prompt: string;
  /** Optional per-run metadata. */
  metadata?: Record<string, unknown>;
}

/** Result returned by the `runModelTurn` activity. */
export interface ModelTurnResult {
  /** New messages produced during this model turn. */
  newMessages: SerializableMessage[];
  /** Whether the run has produced a final result yet. */
  done: boolean;
  /** The final output (only set when `done` is true). */
  output?: unknown;
  /** Serialized usage stats for this turn. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requests: number;
  };
}

/** Parameters passed to the `runToolCall` activity. */
export interface ToolCallParams {
  /** Name of the tool to invoke. */
  toolName: string;
  /** Arguments passed to the tool. */
  args: Record<string, unknown>;
  /** Tool call ID from the model response. */
  toolCallId: string;
  /** Current conversation history (for context). */
  messages: SerializableMessage[];
  /** Optional per-run metadata. */
  metadata?: Record<string, unknown>;
}

/** Result returned by the `runToolCall` activity. */
export interface ToolCallResult {
  /** Tool call ID (echoed back for correlation). */
  toolCallId: string;
  /** The serializable result of the tool. */
  result: unknown;
}

// ---------------------------------------------------------------------------
// Activity history entry (used by MockTemporalAgent)
// ---------------------------------------------------------------------------

/** A single entry in the activity call history recorded by MockTemporalAgent. */
export interface ActivityHistoryEntry {
  /** Name of the activity that was called. */
  activity: string;
  /** Parameters passed to the activity. */
  params: unknown;
  /** Result returned by the activity. */
  result: unknown;
}

// ---------------------------------------------------------------------------
// Re-export RunOptions / RunResult for convenience (callers use this module)
// ---------------------------------------------------------------------------
export type { RunOptions } from "../agent.ts";
export type { ModelMessage, RunResult };
