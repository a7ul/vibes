export type TodoStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface Todo {
  id: string;
  title: string;
  status: TodoStatus;
  parentId?: string;
  dependsOn: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoStore {
  add(todo: Omit<Todo, "id" | "createdAt" | "updatedAt">): Promise<Todo>;
  list(filter?: { status?: TodoStatus }): Promise<Todo[]>;
  update(id: string, status: TodoStatus): Promise<Todo>;
  /** Remove all todos with status "done" or "cancelled". */
  clear(): Promise<void>;
}
