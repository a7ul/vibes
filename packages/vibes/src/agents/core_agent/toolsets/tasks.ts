import { z } from "zod";
import { Agent, FunctionToolset, tool } from "@vibesjs/sdk";
import type { ModelMessage } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { AgentTaskStore, type AgentTask, type AgentType } from "./task_store.ts";
import { bashToolset } from "./bash.ts";
import { filesReadonlyToolset, filesToolset } from "./files.ts";
import { tasksDir } from "../../../file_system.ts";
import { MAX_RETRIES, MAX_TURNS, MODEL } from "../../../constants.ts";
import type { CoreAgentDeps } from "../../../types.ts";
import { SKILL } from "../skill.ts";

function makeStore(deps: CoreAgentDeps): AgentTaskStore {
  return new AgentTaskStore(tasksDir(deps.workflowId), deps.runId);
}

async function findTask(deps: CoreAgentDeps, taskId: string): Promise<AgentTask | string> {
  return (await makeStore(deps).get(taskId)) ?? `Task ${taskId} not found.`;
}

function formatDuration(startedAt: string, completedAt: string): string {
  const secs =
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  return `${secs.toFixed(1)}s`;
}

const TaskIdSchema = z.object({
  task_id: z.string().describe("The task ID to look up"),
});

function createSubAgent(agentType: AgentType): Agent<CoreAgentDeps, string> {
  const toolsets =
    agentType === "general"
      ? [bashToolset, filesToolset]
      : [filesReadonlyToolset];

  return new Agent<CoreAgentDeps, string>({
    name: `${agentType}-sub-agent`,
    model: anthropic(MODEL),
    systemPrompt: SKILL,
    toolsets,
    maxTurns: MAX_TURNS,
    maxRetries: MAX_RETRIES,
  });
}

async function runSubAgent(
  deps: CoreAgentDeps,
  prompt: string,
  description: string,
  agentType: AgentType,
  messageHistory?: ModelMessage[],
): Promise<string> {
  const store = makeStore(deps);
  const task = await store.create(description, agentType);

  try {
    const agent = createSubAgent(agentType);
    const result = await agent.run(prompt, { deps, messageHistory });
    await store.complete(task.id, result.output, result.messages as unknown[]);
    return result.output || "(no output)";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await store.fail(task.id, msg);
    return `Agent failed: ${msg}`;
  }
}

const CreateTaskSchema = z.object({
  prompt: z.string().describe("Detailed instructions for the subagent"),
  description: z.string().describe("Short (3-5 word) summary of what the agent will do"),
  agent_type: z.enum(["general", "explore", "plan"]).default("general"),
});

const createTask = tool<CoreAgentDeps, typeof CreateTaskSchema>({
  name: "create_task",
  description:
    "Spawn a subagent to handle a task. Use 'general' for full capabilities (files+bash), 'explore' or 'plan' for read-only file access.",
  parameters: CreateTaskSchema,
  execute: async (ctx, { prompt, description, agent_type }) => {
    return await runSubAgent(ctx.deps, prompt, description, agent_type);
  },
});

const ResumeTaskSchema = z.object({
  task_id: z.string().describe("ID of a previously completed task"),
  prompt: z.string().describe("Follow-up instructions for the agent"),
});

const resumeTask = tool<CoreAgentDeps, typeof ResumeTaskSchema>({
  name: "resume_task",
  description:
    "Resume a completed agent with additional instructions, continuing with its previous conversation context.",
  parameters: ResumeTaskSchema,
  execute: async (ctx, { task_id, prompt }) => {
    const task = await findTask(ctx.deps, task_id);
    if (typeof task === "string") return task;
    if (task.status === "running") {
      return `Task ${task_id} is still running - can only resume completed or failed tasks.`;
    }
    const history = task.messageHistory as ModelMessage[] | undefined;
    if (!history?.length) return `Task ${task_id} has no conversation history to resume.`;
    return await runSubAgent(
      ctx.deps,
      prompt,
      `resume: ${task.description}`,
      task.agentType,
      history,
    );
  },
});

const listTasks = tool<CoreAgentDeps>({
  name: "list_tasks",
  description: "List all tasks with their status.",
  parameters: z.object({}),
  execute: async (ctx) => {
    const store = makeStore(ctx.deps);
    const tasks = await store.listAll();
    if (!tasks.length) return "No tasks.";
    return tasks
      .map((t) => {
        const duration = t.completedAt
          ? ` (${formatDuration(t.startedAt, t.completedAt)})`
          : "";
        return `  ${t.id}: [${t.status}] ${t.description}${duration}`;
      })
      .join("\n");
  },
});

const getTask = tool<CoreAgentDeps, typeof TaskIdSchema>({
  name: "get_task",
  description: "Get detailed status of a task.",
  parameters: TaskIdSchema,
  execute: async (ctx, { task_id }) => {
    const store = makeStore(ctx.deps);
    const task = await store.get(task_id);
    if (!task) return `Task ${task_id} not found.`;
    const parts = [
      `id: ${task.id}`,
      `description: ${task.description}`,
      `agent_type: ${task.agentType}`,
      `status: ${task.status}`,
      `started_at: ${task.startedAt}`,
    ];
    if (task.completedAt) {
      parts.push(
        `completed_at: ${task.completedAt}`,
        `duration: ${formatDuration(task.startedAt, task.completedAt)}`,
      );
    }
    if (task.error) parts.push(`error: ${task.error}`);
    return parts.join("\n");
  },
});

const getTaskOutput = tool<CoreAgentDeps, typeof TaskIdSchema>({
  name: "get_task_output",
  description: "Get the output of a completed task.",
  parameters: TaskIdSchema,
  execute: async (ctx, { task_id }) => {
    const store = makeStore(ctx.deps);
    const task = await store.get(task_id);
    if (!task) return `Task ${task_id} not found.`;
    if (task.error) return `Task ${task_id} failed: ${task.error}`;
    return task.output ?? "(no output)";
  },
});

export const tasksToolset = new FunctionToolset<CoreAgentDeps>([
  createTask,
  resumeTask,
  listTasks,
  getTask,
  getTaskOutput,
]);
