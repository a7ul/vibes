import type { A2AArtifact, A2AMessage, A2ATask, A2ATaskStatus } from "./types.ts";

export interface TaskStore {
  create(id: string, contextId: string, message: A2AMessage): A2ATask;
  get(id: string): A2ATask | undefined;
  update(
    id: string,
    status: A2ATaskStatus,
    options?: {
      newMessages?: A2AMessage[];
      newArtifacts?: A2AArtifact[];
    },
  ): A2ATask;
  delete(id: string): void;
}

export class MemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, A2ATask>();

  create(id: string, contextId: string, message: A2AMessage): A2ATask {
    const task: A2ATask = {
      kind: "task",
      id,
      contextId,
      status: {
        state: "submitted",
        timestamp: new Date().toISOString(),
      },
      history: [message],
      artifacts: [],
    };
    this.tasks.set(id, task);
    return task;
  }

  get(id: string): A2ATask | undefined {
    return this.tasks.get(id);
  }

  update(
    id: string,
    status: A2ATaskStatus,
    options?: {
      newMessages?: A2AMessage[];
      newArtifacts?: A2AArtifact[];
    },
  ): A2ATask {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    const updated: A2ATask = {
      ...task,
      status,
      history: options?.newMessages
        ? [...(task.history ?? []), ...options.newMessages]
        : task.history,
      artifacts: options?.newArtifacts
        ? [...(task.artifacts ?? []), ...options.newArtifacts]
        : task.artifacts,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  delete(id: string): void {
    this.tasks.delete(id);
  }
}
