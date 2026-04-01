import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/** A static string or a function that returns a string (sync or async). */
export type InstructionPart<TDeps> =
  | string
  | ((ctx: RunContext<TDeps>) => string | Promise<string>);

/**
 * Options for `FunctionToolset`.
 */
export interface FunctionToolsetOptions<TDeps> {
  /**
   * Instructions for this toolset that are automatically included in the
   * model request each turn (via the `system` parameter). Can be a static
   * string, a function, or an array of either.
   *
   * Equivalent to Pydantic AI's `FunctionToolset(instructions=...)`.
   */
  instructions?:
    | InstructionPart<TDeps>
    | ReadonlyArray<InstructionPart<TDeps>>;
}

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
 * const myToolset = new FunctionToolset(
 *   [searchTool, fetchTool],
 *   { instructions: "Use the search tool before fetching." },
 * );
 * ```
 */
export class FunctionToolset<TDeps = undefined> implements Toolset<TDeps> {
  private _tools: ToolDefinition<TDeps>[];
  private _instructions: ReadonlyArray<InstructionPart<TDeps>>;

  constructor(
    tools: ToolDefinition<TDeps>[] = [],
    options?: FunctionToolsetOptions<TDeps>,
  ) {
    this._tools = [...tools];
    const instr = options?.instructions;
    if (instr === undefined || instr === null) {
      this._instructions = [];
    } else if (Array.isArray(instr)) {
      this._instructions = instr;
    } else {
      this._instructions = [instr as InstructionPart<TDeps>];
    }
  }

  addTool(t: ToolDefinition<TDeps>): void {
    this._tools.push(t);
  }

  tools(_ctx?: unknown): ToolDefinition<TDeps>[] {
    return [...this._tools];
  }

  async getInstructions(ctx: RunContext<TDeps>): Promise<string[] | null> {
    if (this._instructions.length === 0) return null;
    const parts: string[] = [];
    for (const instr of this._instructions) {
      const text = typeof instr === "string" ? instr : await instr(ctx);
      if (text && text.trim()) parts.push(text);
    }
    return parts.length > 0 ? parts : null;
  }
}
