import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * A function that receives the current context and the inner toolset's resolved
 * tools, and returns a (possibly modified) list of tools to expose this turn.
 * May add, remove, or reorder tools.
 */
export type PrepareFunction<TDeps = undefined> = (
  ctx: RunContext<TDeps>,
  tools: ToolDefinition<TDeps>[],
) => ToolDefinition<TDeps>[] | Promise<ToolDefinition<TDeps>[]>;

/**
 * Wraps a toolset and calls a `prepare` function on every turn so the exposed
 * tool list can be modified based on the current run context. Useful for
 * dynamically enabling/disabling individual tools, reordering, or injecting
 * context-aware tool variants.
 *
 * Unlike `FilteredToolset` (all-or-nothing), `PreparedToolset` gives
 * fine-grained per-tool control.
 *
 * Equivalent to pydantic-ai's prepared tool pattern.
 *
 * @example
 * ```ts
 * // Only expose "delete" tool after the user has confirmed.
 * const safe = new PreparedToolset(adminTools, (ctx, tools) =>
 *   ctx.deps.confirmed ? tools : tools.filter((t) => t.name !== "delete"),
 * );
 * ```
 */
export class PreparedToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly _inner: Toolset<TDeps>;
  private readonly _prepare: PrepareFunction<TDeps>;

  constructor(inner: Toolset<TDeps>, prepare: PrepareFunction<TDeps>) {
    this._inner = inner;
    this._prepare = prepare;
  }

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const innerTools = await this._inner.tools(ctx);
    return this._prepare(ctx, innerTools);
  }
}
