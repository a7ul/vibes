import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";

/**
 * A composable group of tools. Toolsets are resolved per-turn so they can
 * dynamically include or exclude tools based on the run context.
 *
 * Optional lifecycle hooks mirror Pydantic AI's `AbstractToolset.for_run` /
 * `for_run_step` pattern and enable per-run or per-step state isolation:
 *
 * - `forRun` is called once before the first model turn. Override it to return
 *   a fresh instance scoped to a single run (e.g. open a connection).
 * - `forRunStep` is called at the start of every model turn. Override it to
 *   return a modified instance for that step (e.g. apply step-level filters).
 *
 * Both default to returning `this` (the same shared instance) when not
 * implemented, preserving the existing zero-overhead behaviour for toolsets
 * that do not need isolation.
 *
 * Optionally implement `getInstructions` to provide per-turn instructions that
 * are injected into the system prompt alongside the agent's own instructions.
 * Equivalent to Pydantic AI's `AbstractToolset.get_instructions`.
 */
export interface Toolset<TDeps = undefined> {
  tools(
    ctx: RunContext<TDeps>,
  ): ToolDefinition<TDeps>[] | Promise<ToolDefinition<TDeps>[]>;

  /**
   * Return instructions for how to use this toolset's tools.
   *
   * Called every model turn. The returned string(s) are appended to the
   * agent's combined instructions and included in the `system` parameter of
   * each model call, but are **not** stored in `result.messages`.
   *
   * Return `null`, `undefined`, or an empty array to provide no instructions.
   * A returned string array is joined with `\n\n`.
   *
   * Equivalent to Pydantic AI's `AbstractToolset.get_instructions`.
   */
  getInstructions?(
    ctx: RunContext<TDeps>,
  ):
    | string
    | string[]
    | null
    | undefined
    | Promise<string | string[] | null | undefined>;

  /**
   * Return the toolset instance to use for an entire agent run.
   *
   * Called once per run, before the first model turn. The returned instance
   * (which may be `this` or a fresh copy) is then used for every turn of that
   * run. Override to achieve per-run state isolation — for example, to open
   * a database connection that lives for the lifetime of the run.
   *
   * Default: returns `this` unchanged.
   */
  forRun?(
    ctx: RunContext<TDeps>,
  ): Toolset<TDeps> | Promise<Toolset<TDeps>>;

  /**
   * Return the toolset instance to use for a single model turn (step).
   *
   * Called at the start of every turn with the run-scoped toolset returned by
   * `forRun`. Override to apply per-step mutations or to return a step-scoped
   * copy — for example, to snapshot mutable state before each tool execution.
   *
   * Default: returns `this` unchanged.
   */
  forRunStep?(
    ctx: RunContext<TDeps>,
  ): Toolset<TDeps> | Promise<Toolset<TDeps>>;
}
