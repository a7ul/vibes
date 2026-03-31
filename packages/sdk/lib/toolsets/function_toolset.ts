import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/** Options for `FunctionToolset` construction. */
export type FunctionToolsetOptions<TDeps> = {
  /**
   * Instructions for this toolset that are automatically included in the
   * model request each turn. Can be a static string, a function that receives
   * the run context, or a mixed array of both.
   *
   * Equivalent to Pydantic AI's `FunctionToolset(instructions=...)`.
   */
  instructions?:
    | string
    | ((ctx: RunContext<TDeps>) => string | Promise<string>)
    | Array<string | ((ctx: RunContext<TDeps>) => string | Promise<string>)>;
};

type InstrFn<TDeps> = (ctx: RunContext<TDeps>) => string | Promise<string>;

/**
 * A simple toolset that wraps an array of tool definitions.
 * Equivalent to Pydantic AI's `FunctionToolset`.
 *
 * @example
 * ```ts
 * const myToolset = new FunctionToolset([searchTool, fetchTool]);
 * const agent = new Agent({ model, toolsets: [myToolset] });
 * ```
 *
 * @example With instructions:
 * ```ts
 * const myToolset = new FunctionToolset([searchTool], {
 *   instructions: "Use the search tool to look up information.",
 * });
 * ```
 */
export class FunctionToolset<TDeps = undefined> implements Toolset<TDeps> {
  private _tools: ToolDefinition<TDeps>[];
  private _instructions: Array<string | InstrFn<TDeps>>;

  constructor(
    tools: ToolDefinition<TDeps>[] = [],
    options?: FunctionToolsetOptions<TDeps>,
  ) {
    this._tools = [...tools];
    const raw = options?.instructions;
    if (raw === undefined || raw === null) {
      this._instructions = [];
    } else if (Array.isArray(raw)) {
      this._instructions = raw as Array<string | InstrFn<TDeps>>;
    } else {
      this._instructions = [raw as string | InstrFn<TDeps>];
    }
  }

  addTool(t: ToolDefinition<TDeps>): void {
    this._tools.push(t);
  }

  tools(_ctx?: unknown): ToolDefinition<TDeps>[] {
    return [...this._tools];
  }

  async getInstructions(ctx: RunContext<TDeps>): Promise<string | null> {
    if (this._instructions.length === 0) return null;
    const parts: string[] = [];
    for (const instr of this._instructions) {
      const resolved = typeof instr === "function" ? await instr(ctx) : instr;
      if (resolved) parts.push(resolved);
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
  }
}
