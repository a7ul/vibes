import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * Wraps a toolset with a per-turn predicate. On each turn the predicate
 * receives the run context and returns `true` to expose the full toolset or
 * `false` to hide it entirely.
 * Equivalent to pydantic-ai's `FilteredToolset`.
 *
 * @example
 * ```ts
 * // Only expose admin tools when the user is an admin.
 * const filtered = new FilteredToolset(
 *   adminToolset,
 *   (ctx) => ctx.deps.user.isAdmin,
 * );
 * ```
 */
export class FilteredToolset<TDeps = undefined> implements Toolset<TDeps> {
  constructor(
    private readonly inner: Toolset<TDeps>,
    private readonly predicate: (
      ctx: RunContext<TDeps>,
    ) => boolean | Promise<boolean>,
  ) {}

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const allowed = await this.predicate(ctx);
    if (!allowed) return [];
    return this.inner.tools(ctx);
  }
}
