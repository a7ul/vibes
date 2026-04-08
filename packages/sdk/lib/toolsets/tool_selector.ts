import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";

/**
 * A function that decides whether a tool matches a selection criterion.
 * Receives the run context and a tool definition, returns `true` if selected.
 * Both sync and async functions are accepted.
 */
export type ToolSelectorFn<TDeps = undefined> = (
  ctx: RunContext<TDeps>,
  tool: ToolDefinition<TDeps>,
) => boolean | Promise<boolean>;

/**
 * Specifies which tools a toolset wrapper or capability should apply to.
 *
 * - `'all'`: matches every tool (default).
 * - `string[]`: matches tools whose names are in the array.
 * - `Record<string, unknown>`: matches tools whose `metadata` deeply includes
 *   all the specified key-value pairs.
 * - `ToolSelectorFn`: custom sync or async predicate.
 *
 * Equivalent to Pydantic AI's `ToolSelector`.
 */
export type ToolSelector<TDeps = undefined> =
  | "all"
  | string[]
  | Record<string, unknown>
  | ToolSelectorFn<TDeps>;

/**
 * Check whether `metadata` deeply includes all key-value pairs from `selector`.
 * Nested objects are compared recursively; the tool metadata may have
 * additional keys beyond those in `selector`.
 */
function metadataIncludes(
  metadata: Record<string, unknown>,
  selector: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(selector)) {
    if (!(key in metadata)) return false;
    const actual = metadata[key];
    if (
      expected !== null &&
      typeof expected === "object" &&
      !Array.isArray(expected) &&
      actual !== null &&
      typeof actual === "object" &&
      !Array.isArray(actual)
    ) {
      if (
        !metadataIncludes(
          actual as Record<string, unknown>,
          expected as Record<string, unknown>,
        )
      ) {
        return false;
      }
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/**
 * Check whether a tool definition matches a `ToolSelector`.
 *
 * @param selector - The selector to test against.
 * @param ctx - The current run context.
 * @param toolDef - The tool definition to test.
 * @returns `true` if the tool matches.
 */
export async function matchesToolSelector<TDeps>(
  selector: ToolSelector<TDeps>,
  ctx: RunContext<TDeps>,
  toolDef: ToolDefinition<TDeps>,
): Promise<boolean> {
  if (selector === "all") return true;

  if (typeof selector === "function") {
    return await selector(ctx, toolDef);
  }

  if (Array.isArray(selector)) {
    return selector.includes(toolDef.name);
  }

  // Record<string, unknown> — match by metadata inclusion
  const metadata = toolDef.metadata ?? {};
  return metadataIncludes(metadata, selector);
}
