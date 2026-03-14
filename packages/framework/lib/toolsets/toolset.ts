import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";

/**
 * A composable group of tools. Toolsets are resolved per-turn so they can
 * dynamically include or exclude tools based on the run context.
 */
export interface Toolset<TDeps = undefined> {
  tools(
    ctx: RunContext<TDeps>,
  ): ToolDefinition<TDeps>[] | Promise<ToolDefinition<TDeps>[]>;
}
