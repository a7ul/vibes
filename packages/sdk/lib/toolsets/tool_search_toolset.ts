import { z } from "zod";
import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

const SEARCH_TOOLS_NAME = "search_tools";
const MAX_SEARCH_RESULTS = 10;

// Matches alphanumeric runs (same regex as pydantic-ai's _SEARCH_TOKEN_RE).
// Tokenizing on word boundaries avoids substring false-positives such as
// matching "me" inside "comment".
const SEARCH_TOKEN_RE = /[a-z0-9]+/g;

interface SearchIndexEntry {
  name: string;
  description: string;
  searchTerms: Set<string>;
}

/** Extract the set of lowercase alphanumeric tokens from a string. */
function searchTerms(text: string): Set<string> {
  return new Set(text.toLowerCase().match(SEARCH_TOKEN_RE) ?? []);
}

/** Merge token sets from name and (optional) description. */
function toolSearchTerms(name: string, description: string): Set<string> {
  const terms = searchTerms(name);
  if (description) {
    for (const t of searchTerms(description)) {
      terms.add(t);
    }
  }
  return terms;
}

const searchToolParameters = z.object({
  keywords: z
    .string()
    .describe(
      "Space-separated keywords to match against tool names and descriptions." +
        " Use specific words likely to appear in tool names or descriptions to narrow down relevant tools.",
    ),
});

/**
 * A toolset that enables tool discovery for large toolsets.
 *
 * Wraps another toolset and provides a `search_tools` tool that allows the
 * model to discover tools marked with `deferLoading: true`. Deferred tools are
 * not initially presented to the model; they become available after the model
 * calls `search_tools` to find them by keyword.
 *
 * Equivalent to Pydantic AI's `ToolSearchToolset`.
 *
 * @example
 * ```ts
 * import { Agent, DeferredLoadingToolset, FunctionToolset, ToolSearchToolset, tool } from "@vibesjs/sdk";
 * import { z } from "zod";
 *
 * const bigToolset = new FunctionToolset([...manyTools]);
 * const agent = new Agent({
 *   model,
 *   toolsets: [new ToolSearchToolset(new DeferredLoadingToolset(bigToolset))],
 * });
 * ```
 */
export class ToolSearchToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly _inner: Toolset<TDeps>;
  private readonly _discovered: Set<string>;

  /**
   * @param inner      The wrapped toolset (typically a `DeferredLoadingToolset`
   *                   or any toolset containing tools with `deferLoading: true`).
   * @param discovered Internal: shared discovered-tools set. Used when creating
   *                   step-scoped copies that must share state with the run-scoped
   *                   instance.
   */
  constructor(inner: Toolset<TDeps>, discovered?: Set<string>) {
    this._inner = inner;
    this._discovered = discovered ?? new Set();
  }

  async forRun(ctx: RunContext<TDeps>): Promise<Toolset<TDeps>> {
    const runInner = this._inner.forRun
      ? await this._inner.forRun(ctx)
      : this._inner;
    // Fresh per-run instance with empty discovered set.
    return new ToolSearchToolset<TDeps>(runInner, new Set());
  }

  async forRunStep(ctx: RunContext<TDeps>): Promise<Toolset<TDeps>> {
    if (!this._inner.forRunStep) return this;
    const stepInner = await this._inner.forRunStep(ctx);
    if (stepInner === this._inner) return this;
    // Share the same _discovered set so discoveries made this turn carry over.
    return new ToolSearchToolset<TDeps>(stepInner, this._discovered);
  }

  async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
    const allTools = await this._inner.tools(ctx);

    const deferred: ToolDefinition<TDeps>[] = [];
    const visible: ToolDefinition<TDeps>[] = [];
    for (const t of allTools) {
      if (t.deferLoading) {
        deferred.push(t);
      } else {
        visible.push(t);
      }
    }

    if (deferred.length === 0) {
      return allTools;
    }

    // Build search index for tools not yet discovered.
    const undiscovered = deferred.filter((t) => !this._discovered.has(t.name));

    // All deferred tools already discovered — return everything.
    if (undiscovered.length === 0) {
      return allTools;
    }

    const searchIndex: SearchIndexEntry[] = undiscovered.map((t) => ({
      name: t.name,
      description: t.description,
      searchTerms: toolSearchTerms(t.name, t.description),
    }));

    // Capture reference to `_discovered` for use inside execute.
    const discovered = this._discovered;

    const searchTool: ToolDefinition<TDeps> = {
      name: SEARCH_TOOLS_NAME,
      description:
        "There are additional tools not yet visible to you." +
        " When you need a capability not provided by your current tools," +
        " search here by providing specific keywords to discover and activate relevant tools." +
        " Each keyword is matched independently against tool names and descriptions." +
        " If no tools are found, they do not exist — do not retry.",
      parameters: searchToolParameters,
      maxRetries: 1,
      execute: (_ctx: RunContext<TDeps>, args: unknown) => {
        const { keywords } = args as { keywords: string };
        if (!keywords || !keywords.trim()) {
          return Promise.resolve("Please provide search keywords.");
        }

        const queryTerms = searchTerms(keywords);
        if (queryTerms.size === 0) {
          return Promise.resolve("Please provide search keywords.");
        }

        // Score each tool by the number of query tokens that appear in its
        // search terms (set intersection). Sorts highest score first.
        const scored: Array<{ score: number; name: string; description: string }> = [];
        for (const entry of searchIndex) {
          let score = 0;
          for (const term of queryTerms) {
            if (entry.searchTerms.has(term)) score++;
          }
          if (score > 0) {
            scored.push({ score, name: entry.name, description: entry.description });
          }
        }

        scored.sort((a, b) => b.score - a.score);
        const matches = scored.slice(0, MAX_SEARCH_RESULTS).map(({ name, description }) => ({
          name,
          description,
        }));

        // Mark discovered tools so they appear on the next turn.
        for (const m of matches) {
          discovered.add(m.name);
        }

        if (matches.length === 0) {
          return Promise.resolve(
            "No matching tools found. The tools you need may not be available.",
          );
        }

        return Promise.resolve(JSON.stringify(matches));
      },
    };

    // Return: search_tools first, then visible tools, then already-discovered deferred tools.
    const discoveredTools = deferred.filter((t) => this._discovered.has(t.name));
    return [searchTool, ...visible, ...discoveredTools];
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
