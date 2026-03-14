import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * Adds a prefix to every tool name in the wrapped toolset. Useful when
 * composing toolsets that may have naming conflicts.
 * Equivalent to pydantic-ai's `PrefixedToolset`.
 *
 * @example
 * ```ts
 * const prefixed = new PrefixedToolset(searchToolset, "web_");
 * // "search" becomes "web_search", etc.
 * ```
 */
export class PrefixedToolset<TDeps = undefined> implements Toolset<TDeps> {
  constructor(
    private readonly inner: Toolset<TDeps>,
    private readonly prefix: string,
  ) {}

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const list = await this.inner.tools(ctx);
    return list.map((t) => ({ ...t, name: `${this.prefix}${t.name}` }));
  }
}

/**
 * Renames specific tools in the wrapped toolset using a mapping of
 * `{ oldName: newName }`. Tools not in the map are unchanged.
 * Equivalent to pydantic-ai's `RenamedToolset`.
 *
 * @example
 * ```ts
 * const renamed = new RenamedToolset(myToolset, { search: "find" });
 * ```
 */
export class RenamedToolset<TDeps = undefined> implements Toolset<TDeps> {
  constructor(
    private readonly inner: Toolset<TDeps>,
    private readonly nameMap: Record<string, string>,
  ) {}

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const list = await this.inner.tools(ctx);
    return list.map((t) => {
      const newName = this.nameMap[t.name];
      return newName !== undefined ? { ...t, name: newName } : t;
    });
  }
}
