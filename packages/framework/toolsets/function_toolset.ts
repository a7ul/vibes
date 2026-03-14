import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * A simple toolset that wraps an array of tool definitions.
 * Equivalent to pydantic-ai's `FunctionToolset`.
 *
 * @example
 * ```ts
 * const myToolset = new FunctionToolset([searchTool, fetchTool]);
 * const agent = new Agent({ model, toolsets: [myToolset] });
 * ```
 */
export class FunctionToolset<TDeps = undefined> implements Toolset<TDeps> {
	private _tools: ToolDefinition<TDeps>[];

	constructor(tools: ToolDefinition<TDeps>[] = []) {
		this._tools = [...tools];
	}

	addTool(t: ToolDefinition<TDeps>): void {
		this._tools.push(t);
	}

	tools(): ToolDefinition<TDeps>[] {
		return [...this._tools];
	}
}
