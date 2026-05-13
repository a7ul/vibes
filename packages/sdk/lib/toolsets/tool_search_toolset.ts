import { z } from "zod";
import type { RunContext } from "../types/context.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

const SEARCH_TOOLS_NAME = "search_tools";
const DEFAULT_MAX_SEARCH_RESULTS = 10;
const SEARCH_TOKEN_RE = /[a-z0-9]+/g;

const DEFAULT_TOOL_DESCRIPTION =
  "There are additional tools not yet visible to you." +
  " When you need a capability not provided by your current tools," +
  " search here by providing one or more queries to discover and activate relevant tools." +
  " Each query is tokenized into words; tool names and descriptions are scored by token overlap." +
  " If no tools are found, they do not exist — do not retry.";

const DEFAULT_PARAMETER_DESCRIPTION =
  "List of search queries to match against tool names and descriptions." +
  " Use specific words likely to appear in tool names or descriptions to narrow down relevant tools." +
  " Each query is independently tokenized; matches across queries are unioned.";

/**
 * A function that searches for tools matching the given queries.
 *
 * Receives the run context, the list of search queries, and the deferred tool
 * definitions, and returns the names of matching tools ordered by relevance.
 * Both sync and async implementations are accepted.
 */
export type ToolSearchFn<TDeps = undefined> = (
  ctx: RunContext<TDeps>,
  queries: string[],
  tools: ToolDefinition<TDeps>[],
) => string[] | Promise<string[]>;

/**
 * Options for `ToolSearchToolset`.
 */
export interface ToolSearchToolsetOptions<TDeps = undefined> {
  /**
   * Optional custom search function.
   *
   * Receives the run context, a list of search queries, and the deferred tool
   * definitions that have not yet been discovered. Returns the names of matching
   * tools ordered by relevance. Both sync and async implementations are accepted.
   *
   * If omitted, the default keyword-overlap algorithm is used: each query is
   * tokenized into words and tools are scored by how many query tokens appear
   * in their name or description.
   */
  searchFn?: ToolSearchFn<TDeps>;

  /**
   * Maximum number of tools returned from a single search call.
   *
   * @default 10
   */
  maxResults?: number;

  /**
   * Custom description for the `search_tools` function shown to the model.
   *
   * Overrides the default description when provided.
   */
  toolDescription?: string;

  /**
   * Custom description for the `queries` parameter shown to the model.
   *
   * Overrides the default description when provided.
   */
  parameterDescription?: string;
}

interface SearchIndexEntry {
  name: string;
  description: string;
  searchTerms: Set<string>;
}

function extractSearchTerms(name: string, description: string): Set<string> {
  const combined = (name + " " + description).toLowerCase();
  return new Set(combined.match(SEARCH_TOKEN_RE) ?? []);
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(SEARCH_TOKEN_RE) ?? []);
}

/**
 * Default keyword-overlap search algorithm.
 *
 * Tokenizes all queries into words, unions their tokens, then scores each tool
 * by how many query tokens appear in its name or description. Returns matching
 * tool names ordered by descending score.
 */
function keywordsSearch(
  queries: string[],
  searchIndex: SearchIndexEntry[],
  maxResults: number,
): string[] {
  const terms = tokenize(queries.join(" "));
  if (terms.size === 0) return [];

  const scored: Array<[score: number, name: string]> = [];
  for (const entry of searchIndex) {
    const score = [...terms].filter((t) => entry.searchTerms.has(t)).length;
    if (score > 0) scored.push([score, entry.name]);
  }

  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, maxResults).map(([, name]) => name);
}

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
 *
 * @example Custom search function
 * ```ts
 * const agent = new Agent({
 *   model,
 *   toolsets: [
 *     new ToolSearchToolset(new DeferredLoadingToolset(bigToolset), {
 *       searchFn: async (_ctx, queries, tools) => {
 *         // Custom semantic search — return matching tool names
 *         return mySemanticSearch(queries, tools.map(t => t.name));
 *       },
 *       maxResults: 5,
 *     }),
 *   ],
 * });
 * ```
 */
export class ToolSearchToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly _inner: Toolset<TDeps>;
  private readonly _options: ToolSearchToolsetOptions<TDeps>;
  private readonly _discovered: Set<string>;

  /**
   * @param inner      The wrapped toolset (typically a `DeferredLoadingToolset`
   *                   or any toolset containing tools with `deferLoading: true`).
   * @param options    Optional configuration: custom search function, maxResults,
   *                   toolDescription, parameterDescription.
   */
  constructor(
    inner: Toolset<TDeps>,
    options?: ToolSearchToolsetOptions<TDeps>,
    _discovered?: Set<string>,
  ) {
    this._inner = inner;
    this._options = options ?? {};
    this._discovered = _discovered ?? new Set();
  }

  async forRun(ctx: RunContext<TDeps>): Promise<Toolset<TDeps>> {
    const runInner = this._inner.forRun
      ? await this._inner.forRun(ctx)
      : this._inner;
    // Fresh per-run instance with empty discovered set.
    return new ToolSearchToolset<TDeps>(runInner, this._options, new Set());
  }

  async forRunStep(ctx: RunContext<TDeps>): Promise<Toolset<TDeps>> {
    if (!this._inner.forRunStep) return this;
    const stepInner = await this._inner.forRunStep(ctx);
    if (stepInner === this._inner) return this;
    // Share the same _discovered set so discoveries made this turn carry over.
    return new ToolSearchToolset<TDeps>(
      stepInner,
      this._options,
      this._discovered,
    );
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

    const {
      searchFn,
      maxResults = DEFAULT_MAX_SEARCH_RESULTS,
      toolDescription = DEFAULT_TOOL_DESCRIPTION,
      parameterDescription = DEFAULT_PARAMETER_DESCRIPTION,
    } = this._options;

    const searchIndex: SearchIndexEntry[] = undiscovered.map((t) => ({
      name: t.name,
      description: t.description,
      searchTerms: extractSearchTerms(t.name, t.description),
    }));

    // Capture references for use inside execute.
    const discovered = this._discovered;

    const searchToolParameters = z.object({
      queries: z.array(z.string()).describe(parameterDescription),
    });

    const searchTool: ToolDefinition<TDeps> = {
      name: SEARCH_TOOLS_NAME,
      description: toolDescription,
      parameters: searchToolParameters,
      maxRetries: 1,
      execute: async (execCtx: RunContext<TDeps>, args: unknown) => {
        const { queries } = args as { queries: string[] };
        if (!queries || queries.length === 0) {
          return "Please provide search queries.";
        }

        const nonEmpty = queries.filter((q) => q.trim());
        if (nonEmpty.length === 0) {
          return "Please provide search queries.";
        }

        let matchedNames: string[];
        if (searchFn) {
          matchedNames = await searchFn(execCtx, nonEmpty, undiscovered);
          matchedNames = matchedNames.slice(0, maxResults);
        } else {
          matchedNames = keywordsSearch(nonEmpty, searchIndex, maxResults);
        }

        if (matchedNames.length === 0) {
          return "No matching tools found. The tools you need may not be available.";
        }

        // Build result from the matched names, preserving order.
        const nameToEntry = new Map(
          undiscovered.map((t) => [t.name, { name: t.name, description: t.description }]),
        );
        const matches = matchedNames
          .map((n) => nameToEntry.get(n))
          .filter((e): e is { name: string; description: string } => e !== undefined);

        // Mark discovered tools so they appear on the next turn.
        for (const m of matches) {
          discovered.add(m.name);
        }

        return JSON.stringify(matches);
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
