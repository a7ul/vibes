/**
 * MockTemporalAgent — simulates Temporal's activity-boundary semantics without
 * a running Temporal server.
 *
 * Use this in tests to verify that your agent produces the expected output and
 * that activity calls are made in the expected order. The mock:
 *
 * - Records each activity invocation and its result in an ordered history.
 * - Simulates Temporal's "replay" semantics by re-using recorded results when
 *   the same activity is called with the same parameters.
 * - Does NOT require a Temporal server, worker, or Node.js — works in Deno.
 *
 * @example
 * ```ts
 * const mock = new MockTemporalAgent(agent, { taskQueue: "test" });
 * const result = await mock.run("What is 2+2?");
 * assertEquals(result.output, "4");
 *
 * const history = mock.getActivityHistory();
 * assertEquals(history[0].activity, "runModelTurn");
 * ```
 */

import type { Agent, RunOptions } from "../agent.ts";
import type { RunResult } from "../types/results.ts";
import type {
  ActivityHistoryEntry,
  ModelTurnParams,
  ModelTurnResult,
  TemporalAgentOptions,
} from "./types.ts";
import { serializeRunState } from "./serialization.ts";

// ---------------------------------------------------------------------------
// MockTemporalAgent
// ---------------------------------------------------------------------------

export class MockTemporalAgent<TDeps, TOutput> {
  private readonly _agent: Agent<TDeps, TOutput>;
  private readonly _options: TemporalAgentOptions<TDeps>;
  private readonly _activityHistory: ActivityHistoryEntry[];
  /**
   * Map from stable activity key → recorded result, used for replay
   * simulation. The key is `${activityName}:${JSON.stringify(params)}`.
   */
  private readonly _replayCache: Map<string, unknown>;

  constructor(
    agent: Agent<TDeps, TOutput>,
    options: TemporalAgentOptions<TDeps>,
  ) {
    this._agent = agent;
    this._options = options;
    this._activityHistory = [];
    this._replayCache = new Map();
  }

  // -------------------------------------------------------------------------
  // run
  // -------------------------------------------------------------------------

  /**
   * Run the agent, simulating Temporal's activity-boundary semantics.
   *
   * Each `runModelTurn` call is recorded as an activity invocation. If the
   * same invocation is seen again (same prompt + message history), the
   * cached result is returned, simulating Temporal's deterministic replay.
   *
   * @param prompt - The user prompt.
   * @param opts - Standard {@link RunOptions}.
   */
  async run(
    prompt: string,
    opts?: RunOptions<TDeps>,
  ): Promise<RunResult<TOutput>> {
    const deps = this._options.depsFactory
      ? await this._options.depsFactory()
      : opts?.deps;

    const mergedOpts: RunOptions<TDeps> = {
      ...opts,
      deps: deps as TDeps,
    };

    // Build the params for the simulated activity call
    const serializedHistory = opts?.messageHistory
      ? serializeRunState(opts.messageHistory)
      : [];

    const params: ModelTurnParams = {
      prompt,
      messages: serializedHistory,
      metadata: opts?.metadata,
    };

    // Check replay cache
    const cacheKey = buildCacheKey("runModelTurn", params);
    const cached = this._replayCache.get(cacheKey);

    if (cached !== undefined) {
      const cachedResult = cached as RunResult<TOutput>;
      this._activityHistory.push({
        activity: "runModelTurn",
        params,
        result: { replayed: true, output: cachedResult.output },
      });
      return cachedResult;
    }

    // Execute the real agent run
    let result: RunResult<TOutput>;
    let activityResult: ModelTurnResult;

    try {
      result = await this._agent.run(prompt, mergedOpts);
      activityResult = {
        newMessages: serializeRunState(result.newMessages),
        done: true,
        output: result.output,
        usage: { ...result.usage },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._activityHistory.push({
        activity: "runModelTurn",
        params,
        result: { error: error.message },
      });
      throw error;
    }

    // Record in history and cache
    this._activityHistory.push({
      activity: "runModelTurn",
      params,
      result: activityResult,
    });
    this._replayCache.set(cacheKey, result);

    return result;
  }

  // -------------------------------------------------------------------------
  // Replay simulation
  // -------------------------------------------------------------------------

  /**
   * Simulate a Temporal workflow replay by re-running from the start,
   * using cached activity results where available.
   *
   * This exercises the "deterministic replay" invariant: the workflow
   * must produce the same result when driven from the recorded activity
   * history rather than calling the actual agent.
   *
   * @param prompt - The original prompt (must match the first run).
   * @param opts - Standard run options.
   */
  simulateReplay(
    prompt: string,
    opts?: RunOptions<TDeps>,
  ): Promise<RunResult<TOutput>> {
    // For replay simulation, we re-run but the cache ensures we hit
    // recorded results rather than making new model calls
    return this.run(prompt, opts);
  }

  // -------------------------------------------------------------------------
  // Activity history
  // -------------------------------------------------------------------------

  /**
   * Returns the ordered list of activity invocations recorded during
   * `run()` calls. Each entry includes the activity name, the parameters
   * passed, and the result returned.
   *
   * Useful for assertions in tests:
   * ```ts
   * const history = mock.getActivityHistory();
   * assertEquals(history.length, 1);
   * assertEquals(history[0].activity, "runModelTurn");
   * ```
   */
  getActivityHistory(): ReadonlyArray<ActivityHistoryEntry> {
    return [...this._activityHistory];
  }

  /**
   * Clear the activity history and replay cache.
   * Call between test cases to avoid cross-test pollution.
   */
  reset(): void {
    this._activityHistory.length = 0;
    this._replayCache.clear();
  }

  /** The task queue this agent is registered on. */
  get taskQueue(): string {
    return this._options.taskQueue;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildCacheKey(activityName: string, params: unknown): string {
  return `${activityName}:${JSON.stringify(params)}`;
}
