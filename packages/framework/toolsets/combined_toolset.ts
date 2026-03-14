import type { RunContext } from "../types.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * Merges multiple toolsets into one. Tools from all member toolsets are
 * combined; if two tools share the same name the last one wins.
 * Equivalent to pydantic-ai's `CombinedToolset`.
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
}
