import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";
import { matchesToolSelector, type ToolSelector } from "./tool_selector.ts";

/**
 * Wraps a toolset and merges metadata key-value pairs onto its tools.
 * Tools matched by `selector` get the provided `metadata` shallow-merged
 * into their existing metadata (new values take precedence).
 *
 * The metadata is stored on each `ToolDefinition` but is **not** sent to the
 * model. It can be used for downstream filtering (e.g. another
 * `SetMetadataToolset`) or custom tool-behaviour logic.
 *
 * Equivalent to Pydantic AI's `SetMetadataToolset` and `SetToolMetadata`
 * capability.
 *
 * @example
 * ```ts
 * // Tag all tools in `myToolset` as belonging to the "search" category.
 * const tagged = new SetMetadataToolset(myToolset, { category: "search" });
 *
 * // Tag only tools named "delete" or "update" as destructive.
 * const safe = new SetMetadataToolset(
 *   myToolset,
 *   { destructive: true },
 *   ["delete", "update"],
 * );
 * ```
 */
export class SetMetadataToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly _inner: Toolset<TDeps>;
  private readonly _metadata: Record<string, unknown>;
  private readonly _selector: ToolSelector<TDeps>;

  constructor(
    inner: Toolset<TDeps>,
    metadata: Record<string, unknown>,
    selector: ToolSelector<TDeps> = "all",
  ) {
    this._inner = inner;
    this._metadata = metadata;
    this._selector = selector;
  }

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const innerTools = await this._inner.tools(ctx);
    const result: ToolDefinition<TDeps>[] = [];
    for (const t of innerTools) {
      if (await matchesToolSelector(this._selector, ctx, t)) {
        result.push({ ...t, metadata: { ...(t.metadata ?? {}), ...this._metadata } });
      } else {
        result.push(t);
      }
    }
    return result;
  }
}
