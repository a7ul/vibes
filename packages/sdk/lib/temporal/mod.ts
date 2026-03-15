/**
 * @module temporal
 *
 * Durable execution adapter for the vibes framework using Temporal.io.
 *
 * ## Node.js constraint
 *
 * Temporal's workflow runtime (`@temporalio/workflow`) and worker SDK
 * (`@temporalio/worker`) require Node.js. They use V8 isolates and a custom
 * bundler that is incompatible with Deno's module system.
 *
 * This means:
 * - **Type checking and authoring** can be done in Deno (all types in this
 *   module compile under `deno check`).
 * - **Running Temporal workflows** requires a Node.js worker process. Export
 *   `temporalAgent.activities` and `temporalAgent.workflowFn` and register
 *   them in a separate Node.js entry point that imports
 *   `@temporalio/worker` and `@temporalio/workflow`.
 *
 * ## Recommended structure
 *
 * ```
 * packages/
 *   framework/          ← Deno, this module
 *     temporal/
 *       mod.ts          ← types + TemporalAgent (type-safe, Deno-compatible)
 *   temporal-worker/    ← Node.js package
 *     src/
 *       worker.ts       ← imports framework's activities, starts Temporal worker
 *       workflows.ts    ← re-exports workflowFn as a Temporal workflow
 * ```
 *
 * ## Quick start
 *
 * ```ts
 * import { Agent } from "@vibesjs/sdk";
 * import { TemporalAgent } from "@vibesjs/sdk/temporal";
 * import { anthropic } from "@ai-sdk/anthropic";
 *
 * const agent = new Agent({
 *   model: anthropic("claude-3-5-haiku-20241022"),
 *   systemPrompt: "You are a helpful assistant.",
 * });
 *
 * export const temporalAgent = new TemporalAgent(agent, {
 *   taskQueue: "my-task-queue",
 *   modelCallActivity: { startToCloseTimeout: "2m" },
 * });
 *
 * // -- In your Node.js worker (packages/temporal-worker/src/worker.ts) ------
 * // import { Worker } from "@temporalio/worker";
 * // import { temporalAgent } from "../../framework/temporal/mod.ts";
 * //
 * // const worker = await Worker.create({
 * //   taskQueue: temporalAgent.taskQueue,
 * //   activities: temporalAgent.activities,
 * //   workflowsPath: require.resolve("./workflows"),
 * // });
 * // await worker.run();
 * // -------------------------------------------------------------------------
 *
 * // For local development and testing - no Temporal server needed:
 * const mock = new MockTemporalAgent(agent, { taskQueue: "test" });
 * const result = await mock.run("Hello!");
 * ```
 */

export { TemporalAgent } from "./temporal_agent.ts";
export { MockTemporalAgent } from "./mock_temporal.ts";
export {
  deserializeRunState,
  roundTripMessages,
  serializeRunState,
} from "./serialization.ts";

export type {
  ActivityHistoryEntry,
  ModelTurnParams,
  ModelTurnResult,
  SerializableMessage,
  SerializableRunOptions,
  TemporalActivityOptions,
  TemporalAgentOptions,
  ToolCallParams,
  ToolCallResult,
} from "./types.ts";
