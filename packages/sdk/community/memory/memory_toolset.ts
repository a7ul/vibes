import { z } from "zod";
import { tool } from "../../lib/tool.ts";
import type { ToolDefinition } from "../../lib/tool.ts";
import type { Toolset } from "../../lib/toolsets/toolset.ts";
import type { RunContext } from "../../lib/types/context.ts";
import type { MemoryStore } from "./types.ts";
import { InMemoryStore } from "./in_memory_store.ts";

const SaveParams = z.object({
  key: z.string().describe("Unique name / identifier for this memory"),
  content: z.string().describe("The fact or value to store"),
  tags: z.array(z.string()).optional().describe("Optional labels for grouping (e.g. [\"user\", \"preference\"])"),
});

const RecallParams = z.object({
  key: z.string().describe("Exact key of the memory to retrieve"),
});

const SearchParams = z.object({
  query: z.string().describe("Keyword to search across memory keys, content, and tags"),
});

const DeleteParams = z.object({
  key: z.string().describe("Key of the memory to remove"),
});

const ListParams = z.object({});

/**
 * A toolset that gives an agent a persistent key-value memory scratchpad.
 *
 * Exposes five tools: `memory_save`, `memory_recall`, `memory_search`, `memory_delete`, `memory_list`.
 *
 * @example
 * ```ts
 * import { Agent } from "@vibesjs/sdk";
 * import { MemoryToolset } from "@vibesjs/sdk";
 * import { anthropic } from "@ai-sdk/anthropic";
 *
 * const agent = new Agent({
 *   model: anthropic("claude-sonnet-4-6"),
 *   toolsets: [new MemoryToolset()],
 * });
 * ```
 *
 * Pass a custom `MemoryStore` for persistent storage:
 * ```ts
 * const agent = new Agent({
 *   model: anthropic("claude-sonnet-4-6"),
 *   toolsets: [new MemoryToolset(myPersistentStore)],
 * });
 * ```
 */
export class MemoryToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly store: MemoryStore;

  constructor(store?: MemoryStore) {
    this.store = store ?? new InMemoryStore();
  }

  tools(_ctx: RunContext<TDeps>): ToolDefinition<TDeps>[] {
    const store = this.store;

    return [
      tool<TDeps, typeof SaveParams>({
        name: "memory_save",
        description: "Store a named memory. Upserts by key — calling again with the same key overwrites the previous value.",
        parameters: SaveParams,
        execute: async (_ctx, args) => {
          const memory = await store.save(args.key, args.content, args.tags ?? []);
          return JSON.stringify(memory);
        },
      }),

      tool<TDeps, typeof RecallParams>({
        name: "memory_recall",
        description: "Retrieve a single memory by exact key. Returns null if not found.",
        parameters: RecallParams,
        execute: async (_ctx, args) => {
          const memory = await store.recall(args.key);
          return JSON.stringify(memory);
        },
      }),

      tool<TDeps, typeof SearchParams>({
        name: "memory_search",
        description: "Search across all memories by keyword. Matches against key, content, and tags (case-insensitive substring).",
        parameters: SearchParams,
        execute: async (_ctx, args) => {
          const results = await store.search(args.query);
          return JSON.stringify(results);
        },
      }),

      tool<TDeps, typeof DeleteParams>({
        name: "memory_delete",
        description: "Remove a memory by key. Returns true if it existed and was removed, false if not found.",
        parameters: DeleteParams,
        execute: async (_ctx, args) => {
          const removed = await store.delete(args.key);
          return JSON.stringify({ removed });
        },
      }),

      tool<TDeps, typeof ListParams>({
        name: "memory_list",
        description: "List all memory keys and their tags. Does not return full content to keep token use low.",
        parameters: ListParams,
        execute: async () => {
          const entries = await store.list();
          return JSON.stringify(entries);
        },
      }),
    ];
  }
}
