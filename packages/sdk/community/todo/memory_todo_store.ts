import type { Todo, TodoStatus, TodoStore } from "./types.ts";

/**
 * In-memory TodoStore implementation. State is lost when the process exits.
 * Pass a custom `TodoStore` to `TodoToolset` for persistent storage.
 */
export class MemoryTodoStore implements TodoStore {
  private readonly todos: Map<string, Todo> = new Map();
  private nextId = 1;

  add(todo: Omit<Todo, "id" | "createdAt" | "updatedAt">): Promise<Todo> {
    const now = new Date();
    const newTodo: Todo = {
      ...todo,
      id: String(this.nextId++),
      createdAt: now,
      updatedAt: now,
    };
    this.todos.set(newTodo.id, newTodo);
    return Promise.resolve(newTodo);
  }

  list(filter?: { status?: TodoStatus }): Promise<Todo[]> {
    const all = Array.from(this.todos.values());
    if (!filter?.status) return Promise.resolve(all);
    return Promise.resolve(all.filter((t) => t.status === filter.status));
  }

  update(id: string, status: TodoStatus): Promise<Todo> {
    const todo = this.todos.get(id);
    if (!todo) return Promise.reject(new Error(`Todo not found: ${id}`));
    const updated: Todo = { ...todo, status, updatedAt: new Date() };
    this.todos.set(id, updated);
    return Promise.resolve(updated);
  }

  clear(): Promise<void> {
    for (const [id, todo] of this.todos) {
      if (todo.status === "done" || todo.status === "cancelled") {
        this.todos.delete(id);
      }
    }
    return Promise.resolve();
  }
}
