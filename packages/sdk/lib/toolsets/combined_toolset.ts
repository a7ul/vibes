import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * Merges multiple toolsets into one. Tools from all member toolsets are
 * combined; if two tools share the same name the last one wins.
 * Equivalent to Pydantic AI's `CombinedToolset`.
 *
 * @example
 * ```ts
 * const combined = new CombinedToolset(searchToolset, fetchToolset);
 * const agent = new Agent({ model, toolsets: [combined] });
 * ```
 */
export class CombinedToolset<TDeps = undefined> implements Toolset<TDeps> {
  private _toolsets: Toolset<TDeps>[];

  constructor(...toolsets: Toolset<TDeps>[]) {
    this._toolsets = toolsets;
  }

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const byName = new Map<string, ToolDefinition<TDeps>>();
    for (const ts of this._toolsets) {
      const list = await ts.tools(ctx);
      for (const t of list) {
        byName.set(t.name, t);
      }
    }
    return [...byName.values()];
  }

  /**
   * Propagates `forRun` to all child toolsets in parallel and returns a new
   * `CombinedToolset` wrapping the resulting run-scoped instances.
   * Equivalent to Pydantic AI's `CombinedToolset.for_run`.
   */
  async forRun(ctx: RunContext<TDeps>): Promise<CombinedToolset<TDeps>> {
    const newToolsets = await Promise.all(
      this._toolsets.map((ts) =>
        ts.forRun ? ts.forRun(ctx) : Promise.resolve(ts)
      ),
    );
    return new CombinedToolset(...newToolsets);
  }

  /**
   * Propagates `forRunStep` to all child toolsets in parallel. Returns `this`
   * when no child returned a new instance, otherwise a new `CombinedToolset`.
   * Equivalent to Pydantic AI's `CombinedToolset.for_run_step`.
   */
  async forRunStep(ctx: RunContext<TDeps>): Promise<CombinedToolset<TDeps>> {
    const newToolsets = await Promise.all(
      this._toolsets.map((ts) =>
        ts.forRunStep ? ts.forRunStep(ctx) : Promise.resolve(ts)
      ),
    );
    if (newToolsets.every((ts, i) => ts === this._toolsets[i])) {
      return this;
    }
    return new CombinedToolset(...newToolsets);
  }
}
