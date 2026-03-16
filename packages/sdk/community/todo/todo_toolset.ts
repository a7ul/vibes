import { z } from "zod";
import { tool } from "../../lib/tool.ts";
import type { ToolDefinition } from "../../lib/tool.ts";
import type { Toolset } from "../../lib/toolsets/toolset.ts";
import type { RunContext } from "../../lib/types/context.ts";
import type { TodoStore } from "./types.ts";
import { MemoryTodoStore } from "./memory_todo_store.ts";

const StatusSchema = z.enum(["pending", "in_progress", "done", "cancelled"]);

const AddParams = z.object({
  title: z.string().describe("Title of the todo item"),
  parentId: z.string().optional().describe("Optional parent todo ID for sub-tasks"),
  dependsOn: z.array(z.string()).optional().describe("IDs of todos that must complete before this one"),
});

const ListParams = z.object({
  status: StatusSchema.optional().describe("Filter by status; omit to list all todos"),
});

const UpdateParams = z.object({
  id: z.string().describe("ID of the todo to update"),
  status: StatusSchema.describe("New status for the todo"),
});

const ClearParams = z.object({});

/**
 * A toolset that gives an agent a simple task-tracking system.
 *
 * Exposes four tools: `todo_add`, `todo_list`, `todo_update`, `todo_clear`.
 *
 * @example
 * ```ts
 * import { Agent } from "@vibesjs/sdk";
 * import { TodoToolset } from "@vibesjs/sdk";
 * import { anthropic } from "@ai-sdk/anthropic";
 *
 * const agent = new Agent({
 *   model: anthropic("claude-sonnet-4-6"),
 *   toolsets: [new TodoToolset()],
 * });
 * ```
 *
 * Pass a custom `TodoStore` for persistent storage:
 * ```ts
 * const agent = new Agent({
 *   model: anthropic("claude-sonnet-4-6"),
 *   toolsets: [new TodoToolset(myPersistentStore)],
 * });
 * ```
 */
export class TodoToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly store: TodoStore;

  constructor(store?: TodoStore) {
    this.store = store ?? new MemoryTodoStore();
  }

  tools(_ctx: RunContext<TDeps>): ToolDefinition<TDeps>[] {
    const store = this.store;

    return [
      tool<TDeps, typeof AddParams>({
        name: "todo_add",
        description: "Create a new todo item. Returns the created todo with its assigned ID.",
        parameters: AddParams,
        execute: async (_ctx, args) => {
          const todo = await store.add({
            title: args.title,
            status: "pending",
            parentId: args.parentId,
            dependsOn: args.dependsOn ?? [],
          });
          return JSON.stringify(todo);
        },
      }),

      tool<TDeps, typeof ListParams>({
        name: "todo_list",
        description: "List todo items. Optionally filter by status.",
        parameters: ListParams,
        execute: async (_ctx, args) => {
          const todos = await store.list(
            args.status ? { status: args.status } : undefined,
          );
          return JSON.stringify(todos);
        },
      }),

      tool<TDeps, typeof UpdateParams>({
        name: "todo_update",
        description: "Update the status of a todo item.",
        parameters: UpdateParams,
        execute: async (_ctx, args) => {
          const todo = await store.update(args.id, args.status);
          return JSON.stringify(todo);
        },
      }),

      tool<TDeps, typeof ClearParams>({
        name: "todo_clear",
        description: 'Remove all todos whose status is "done" or "cancelled".',
        parameters: ClearParams,
        execute: async () => {
          await store.clear();
          return "Cleared all completed and cancelled todos.";
        },
      }),
    ];
  }
}
