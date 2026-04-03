import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * A toolset that marks tools for deferred loading, hiding them from the model
 * until discovered via tool search.
 *
 * Wrap any toolset with `DeferredLoadingToolset` and then wrap the result with
 * `ToolSearchToolset` to enable tool discovery. The model will only see the
 * deferred tools after calling the `search_tools` tool.
 *
 * Equivalent to Pydantic AI's `DeferredLoadingToolset`.
 *
 * @example
 * ```ts
 * const ts = new ToolSearchToolset(
 *   new DeferredLoadingToolset(new FunctionToolset([largeToolList]))
 * );
 * const agent = new Agent({ model, toolsets: [ts] });
 * ```
 */
export class DeferredLoadingToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly _inner: Toolset<TDeps>;
  private readonly _toolNames: Set<string> | undefined;

  /**
   * @param inner     The wrapped toolset whose tools should be deferred.
   * @param toolNames Optional set of tool names to mark for deferred loading.
   *                  When omitted all tools from the inner toolset are deferred.
   */
  constructor(inner: Toolset<TDeps>, toolNames?: ReadonlySet<string>) {
    this._inner = inner;
    this._toolNames = toolNames !== undefined ? new Set(toolNames) : undefined;
  }

  async forRun(ctx: RunContext<TDeps>): Promise<Toolset<TDeps>> {
    const runInner = this._inner.forRun
      ? await this._inner.forRun(ctx)
      : this._inner;
    return new DeferredLoadingToolset(runInner, this._toolNames);
  }

  async forRunStep(ctx: RunContext<TDeps>): Promise<Toolset<TDeps>> {
    if (!this._inner.forRunStep) return this;
    const stepInner = await this._inner.forRunStep(ctx);
    if (stepInner === this._inner) return this;
    return new DeferredLoadingToolset(stepInner, this._toolNames);
  }

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const innerTools = await this._inner.tools(ctx);
    return innerTools.map((t): ToolDefinition<TDeps> => {
      const shouldDefer =
        this._toolNames === undefined || this._toolNames.has(t.name);
      return shouldDefer ? { ...t, deferLoading: true } : t;
    });
  }

  getInstructions(
    ctx: RunContext<TDeps>,
  ):
    | string
    | string[]
    | null
    | undefined
    | Promise<string | string[] | null | undefined> {
    return this._inner.getInstructions?.(ctx);
  }
}
