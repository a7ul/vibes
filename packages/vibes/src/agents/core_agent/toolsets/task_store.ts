import { join } from "@std/path";

export type TaskStatus = "running" | "completed" | "failed";
export type AgentType = "general" | "explore" | "plan";

export interface AgentTask {
  id: string;
  description: string;
  agentType: AgentType;
  status: TaskStatus;
  startedAt: string;
  completedAt?: string;
  output?: string;
  error?: string;
  messageHistory?: unknown[];
}

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export class AgentTaskStore {
  private taskDir: string;
  private runId: string;

  constructor(taskDir: string, runId: string) {
    this.taskDir = taskDir;
    this.runId = runId;
  }

  private get filePath(): string {
    return join(this.taskDir, `tasks_${this.runId}.json`);
  }

  private async readAll(): Promise<AgentTask[]> {
    try {
      const text = await Deno.readTextFile(this.filePath);
      return JSON.parse(text) as AgentTask[];
    } catch {
      return [];
    }
  }

  private async writeAll(tasks: AgentTask[]): Promise<void> {
    await Deno.mkdir(this.taskDir, { recursive: true });
    await Deno.writeTextFile(this.filePath, JSON.stringify(tasks, null, 2));
  }

  async create(description: string, agentType: AgentType): Promise<AgentTask> {
    const tasks = await this.readAll();
    const task: AgentTask = {
      id: randomId(),
      description,
      agentType,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    await this.writeAll([...tasks, task]);
    return task;
  }

  async get(taskId: string): Promise<AgentTask | undefined> {
    const tasks = await this.readAll();
    return tasks.find((t) => t.id === taskId);
  }

  async listAll(): Promise<AgentTask[]> {
    return await this.readAll();
  }

  private async updateTask(
    taskId: string,
    fields: Partial<AgentTask>,
  ): Promise<void> {
    const tasks = await this.readAll();
    await this.writeAll(
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, completedAt: new Date().toISOString(), ...fields }
          : t
      ),
    );
  }

  async complete(
    taskId: string,
    output: string,
    messageHistory?: unknown[],
  ): Promise<void> {
    await this.updateTask(taskId, {
      status: "completed",
      output,
      messageHistory,
    });
  }

  async fail(taskId: string, error: string): Promise<void> {
    await this.updateTask(taskId, { status: "failed", error });
  }
}
