/**
 * TemporalAgent — wraps an {@link Agent} with Temporal activity-boundary
 * semantics.
 *
 * ## Node.js constraint
 *
 * Temporal's workflow runtime requires a Node.js worker process (the
 * `@temporalio/worker` package). This file can be type-checked and imported
 * from Deno, but to actually register the activities and start a Temporal
 * worker you must run the exported `activities` object and `workflowFn` inside
 * a Node.js process that has `@temporalio/worker` and `@temporalio/workflow`
 * installed.
 *
 * See `temporal/mod.ts` for the full constraint explanation and a usage
 * example.
 *
 * ## What this class provides
 *
 * - `activities` — plain async functions ready to register with a Temporal
 *   worker (`worker.create({ activities })`)
 * - `workflowFn` — a deterministic Temporal workflow function that drives the
 *   agent turn-loop via activity calls
 * - `run()` — a non-Temporal fallback for local development and testing
 */

import type { Agent, RunOptions } from "../agent.ts";
import type { RunResult } from "../types/results.ts";
import type {
  ModelTurnParams,
  ModelTurnResult,
  SerializableRunOptions,
  TemporalAgentOptions,
  ToolCallParams,
  ToolCallResult,
} from "./types.ts";
import { deserializeRunState, serializeRunState } from "./serialization.ts";

// ---------------------------------------------------------------------------
// TemporalAgent
// ---------------------------------------------------------------------------

/**
 * Wraps an `Agent<TDeps, TOutput>` with Temporal activity-boundary semantics.
 *
 * ```ts
 * const agent = new Agent({ model, systemPrompt: "You are helpful" });
 * const temporalAgent = new TemporalAgent(agent, {
 *   taskQueue: "my-queue",
 *   modelCallActivity: { startToCloseTimeout: "2m" },
 * });
 *
 * // In a Node.js worker process:
 * // const worker = await Worker.create({ activities: temporalAgent.activities, ... });
 *
 * // For local testing (no Temporal):
 * const result = await temporalAgent.run("What is 2+2?");
 * ```
 */
export class TemporalAgent<TDeps, TOutput> {
  private readonly _agent: Agent<TDeps, TOutput>;
  private readonly _options: TemporalAgentOptions<TDeps>;

  constructor(
    agent: Agent<TDeps, TOutput>,
    options: TemporalAgentOptions<TDeps>,
  ) {
    this._agent = agent;
    this._options = options;
  }

  // -------------------------------------------------------------------------
  // activities
  // -------------------------------------------------------------------------

  /**
   * Activity functions for registration with a Temporal worker.
   *
   * In a Node.js worker process:
   * ```ts
   * import { Worker } from "@temporalio/worker";
   * const worker = await Worker.create({
   *   taskQueue: "my-queue",
   *   activities: temporalAgent.activities,
   * });
   * ```
   *
   * Each activity is a plain async function that performs a single agent
   * step and returns a JSON-serializable result. Temporal will retry failed
   * activities according to the configured retry policy.
   */
  readonly activities: {
    runModelTurn: (params: ModelTurnParams) => Promise<ModelTurnResult>;
    runToolCall: (params: ToolCallParams) => Promise<ToolCallResult>;
  } = {
    runModelTurn: async (params: ModelTurnParams): Promise<ModelTurnResult> => {
      const deps = this._options.depsFactory
        ? await this._options.depsFactory()
        : undefined;

      const messageHistory = params.messages.length > 0
        ? deserializeRunState(params.messages)
        : undefined;

      // Run one full agent turn. Since we cannot intercept mid-turn (the AI
      // SDK drives the tool loop internally), we run the full agent and
      // return the final result. For partial-turn granularity, use the
      // activity-per-tool pattern with deferred tools.
      const result = await this._agent.run(params.prompt, {
        deps: deps as TDeps,
        messageHistory,
        metadata: params.metadata,
      } as RunOptions<TDeps>);

      return {
        newMessages: serializeRunState(result.newMessages),
        done: true,
        output: result.output,
        usage: { ...result.usage },
      };
    },

    // deno-lint-ignore require-await
    runToolCall: async (params: ToolCallParams): Promise<ToolCallResult> => {
      // Individual tool invocations are not exposed as separate entry
      // points by the AI SDK's run loop. This activity is provided for
      // custom workflows that want finer-grained control (e.g., wrapping
      // each tool call as its own Temporal activity). In such a setup the
      // caller drives the message loop manually and calls this activity
      // once per tool call returned by the model.
      //
      // For a simpler integration, use runModelTurn which wraps the full
      // agent run (including all tool calls) in a single activity.
      void params; // acknowledged — implementation is caller-specific
      throw new Error(
        "runToolCall: custom per-tool activity wiring is not implemented in " +
          "TemporalAgent. Use runModelTurn for full-run activity semantics, or " +
          "subclass TemporalAgent to add per-tool activity dispatch.",
      );
    },
  };

  // -------------------------------------------------------------------------
  // workflowFn
  // -------------------------------------------------------------------------

  /**
   * A deterministic workflow function for registration with Temporal.
   *
   * In a Node.js workflow bundle:
   * ```ts
   * import { proxyActivities } from "@temporalio/workflow";
   * export const myWorkflow = temporalAgent.workflowFn;
   * ```
   *
   * The function drives the agent turn-loop by calling the `runModelTurn`
   * activity via Temporal's activity proxy. This ensures each turn is
   * durable — if the workflow is interrupted, Temporal will replay from the
   * last committed activity result.
   *
   * NOTE: In production you must wrap activity calls with
   * `proxyActivities()` from `@temporalio/workflow`. This stub calls the
   * activities directly and is provided so the workflow logic can be
   * type-checked and tested outside a Temporal environment.
   */
  readonly workflowFn: (
    prompt: string,
    opts?: SerializableRunOptions,
  ) => Promise<TOutput> = async (
    prompt: string,
    opts?: SerializableRunOptions,
  ): Promise<TOutput> => {
    const messages: ModelTurnParams["messages"] = opts?.messageHistory ?? [];

    const turnResult = await this.activities.runModelTurn({
      prompt,
      messages,
      metadata: opts?.metadata,
    });

    if (!turnResult.done) {
      throw new Error(
        "workflowFn: runModelTurn returned done=false. " +
          "Multi-turn partial activity is not yet supported in this implementation.",
      );
    }

    return turnResult.output as TOutput;
  };

  // -------------------------------------------------------------------------
  // run (non-Temporal fallback)
  // -------------------------------------------------------------------------

  /**
   * Run the agent without Temporal, returning a standard {@link RunResult}.
   * Useful for local development and testing where a Temporal server is not
   * available.
   *
   * @param prompt - The user prompt.
   * @param opts - Standard {@link RunOptions}.
   */
  run(prompt: string, opts?: RunOptions<TDeps>): Promise<RunResult<TOutput>> {
    return this._agent.run(prompt, opts);
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** The underlying agent instance. */
  get agent(): Agent<TDeps, TOutput> {
    return this._agent;
  }

  /** The Temporal configuration options. */
  get options(): Readonly<TemporalAgentOptions<TDeps>> {
    return this._options;
  }

  /** The task queue this agent is registered on. */
  get taskQueue(): string {
    return this._options.taskQueue;
  }
}
