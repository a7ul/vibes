import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import { MemoryTaskStore, type TaskStore } from "./task_store.ts";
import type {
  A2AArtifact,
  A2ADataPart,
  A2AFilePart,
  A2AMessage,
  A2APart,
  A2AStreamEvent,
  A2ATask,
  A2ATaskStatus,
  A2ATextPart,
  AgentCard,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess,
  TaskCancelParams,
  TaskGetParams,
  TaskSendParams,
} from "./types.ts";
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  TASK_NOT_FOUND,
} from "./types.ts";
import {
  binaryContentToBase64,
  isBinaryContent,
} from "../multimodal/binary_content.ts";

// Silence unused import warnings - these are re-exported via types but used
// only as type-level references in this file.
void INTERNAL_ERROR;
void INVALID_REQUEST;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface A2AAdapterOptions<TDeps> {
  /** Agent card fields */
  name?: string;
  description?: string;
  url?: string;
  version?: string;
  skills?: AgentCard["skills"];
  provider?: AgentCard["provider"];
  /** Dependencies injected into every agent run. */
  deps?: TDeps;
  /** Custom task store (defaults to MemoryTaskStore). */
  taskStore?: TaskStore;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return globalThis.crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function ok<T>(id: string | number | null, result: T): JsonRpcSuccess<T> {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseChunk(event: A2AStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/** Convert A2A message parts to a plain text prompt. */
function partsToPrompt(parts: A2APart[]): string {
  return parts
    .filter((p): p is A2ATextPart => p.kind === "text")
    .map((p) => p.text)
    .join("\n");
}

/** Convert A2A history to ModelMessage[]. */
function historyToMessages(history: A2AMessage[]): ModelMessage[] {
  return history.map((msg): ModelMessage => {
    const text = partsToPrompt(msg.parts);
    if (msg.role === "user") {
      return { role: "user", content: text };
    }
    return {
      role: "assistant",
      content: [{ type: "text", text }],
    };
  });
}

/** Convert an agent output value to A2A artifacts. */
function outputToArtifacts(output: unknown): A2AArtifact[] {
  const part = outputToPart(output);
  return [
    {
      artifactId: generateId(),
      name: "result",
      parts: [part],
    },
  ];
}

function outputToPart(output: unknown): A2APart {
  if (isBinaryContent(output)) {
    const bytes = binaryContentToBase64(output);
    return {
      kind: "file",
      file: { bytes, mimeType: output.mimeType, name: "output" },
    } satisfies A2AFilePart;
  }
  if (typeof output === "string") {
    return { kind: "text", text: output } satisfies A2ATextPart;
  }
  return {
    kind: "data",
    data: { result: output },
  } satisfies A2ADataPart;
}

function agentMessage(parts: A2APart[]): A2AMessage {
  return {
    kind: "message",
    messageId: generateId(),
    role: "agent",
    parts,
  };
}

// ---------------------------------------------------------------------------
// A2AAdapter
// ---------------------------------------------------------------------------

export class A2AAdapter<TDeps, TOutput> {
  private readonly agent: Agent<TDeps, TOutput>;
  private readonly options: A2AAdapterOptions<TDeps>;
  private readonly store: TaskStore;
  private readonly card: AgentCard;
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    agent: Agent<TDeps, TOutput>,
    options: A2AAdapterOptions<TDeps> = {},
  ) {
    this.agent = agent;
    this.options = options;
    this.store = options.taskStore ?? new MemoryTaskStore();
    this.card = {
      name: options.name ?? agent.name ?? "Agent",
      description: options.description,
      url: options.url ?? "http://localhost:8000",
      version: options.version ?? "1.0.0",
      capabilities: { streaming: true },
      skills: options.skills ?? [],
      provider: options.provider,
    };
  }

  /** Returns a Deno-compatible HTTP handler. */
  handler(): (req: Request) => Promise<Response> {
    return (req: Request): Promise<Response> => this.handleRequest(req);
  }

  handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Agent card endpoint
    if (req.method === "GET" && url.pathname === "/.well-known/agent.json") {
      return Promise.resolve(jsonResponse(this.card));
    }

    // JSON-RPC endpoint
    if (req.method === "POST" && url.pathname === "/") {
      return this.handleJsonRpc(req);
    }

    return Promise.resolve(new Response("Not Found", { status: 404 }));
  }

  private async handleJsonRpc(req: Request): Promise<Response> {
    let rpc: JsonRpcRequest;
    try {
      const body: unknown = await req.json();
      rpc = validateJsonRpc(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse error";
      return jsonResponse(rpcError(null, PARSE_ERROR, msg));
    }

    const id = rpc.id ?? null;

    switch (rpc.method) {
      case "message/send":
      case "tasks/send":
        return jsonResponse(await this.handleTaskSend(id, rpc.params));
      case "message/stream":
      case "tasks/sendSubscribe":
        return this.handleTaskSendSubscribe(id, rpc.params);
      case "tasks/get":
        return jsonResponse(this.handleTaskGet(id, rpc.params));
      case "tasks/cancel":
        return jsonResponse(this.handleTaskCancel(id, rpc.params));
      default:
        return jsonResponse(
          rpcError(id, METHOD_NOT_FOUND, `Method not found: ${rpc.method}`),
        );
    }
  }

  private async handleTaskSend(
    id: string | number | null,
    params: unknown,
  ): Promise<JsonRpcResponse<A2ATask>> {
    let p: TaskSendParams;
    try {
      p = validateTaskSendParams(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid params";
      return rpcError(id, INVALID_PARAMS, msg);
    }

    const contextId = p.contextId ?? generateId();
    const task = this.store.create(p.id, contextId, p.message);

    // Build conversation from message history in the task
    const history = task.history ?? [];
    const prompt = partsToPrompt(p.message.parts);
    const messageHistory = historyToMessages(history.slice(0, -1));

    // Update status to working
    const workingStatus: A2ATaskStatus = {
      state: "working",
      timestamp: nowIso(),
    };
    this.store.update(p.id, workingStatus);

    try {
      const result = await this.agent.run(prompt, {
        deps: this.options.deps as TDeps,
        messageHistory,
      });

      const artifacts = outputToArtifacts(result.output);
      const agentMsg = agentMessage([outputToPart(result.output)]);

      const completedStatus: A2ATaskStatus = {
        state: "completed",
        timestamp: nowIso(),
      };
      const finalTask = this.store.update(p.id, completedStatus, {
        newMessages: [agentMsg],
        newArtifacts: artifacts,
      });

      return ok(id, finalTask);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const failedStatus: A2ATaskStatus = {
        state: "failed",
        message: agentMessage([{ kind: "text", text: msg }]),
        timestamp: nowIso(),
      };
      const failedTask = this.store.update(p.id, failedStatus);
      return ok(id, failedTask);
    }
  }

  private handleTaskSendSubscribe(
    id: string | number | null,
    params: unknown,
  ): Response {
    let p: TaskSendParams;
    try {
      p = validateTaskSendParams(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid params";
      const body = JSON.stringify(rpcError(id, INVALID_PARAMS, msg));
      return new Response(body, {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contextId = p.contextId ?? generateId();
    const task = this.store.create(p.id, contextId, p.message);
    const history = task.history ?? [];
    const prompt = partsToPrompt(p.message.parts);
    const messageHistory = historyToMessages(history.slice(0, -1));
    const taskId = p.id;
    const agent = this.agent;
    const store = this.store;
    const deps = this.options.deps;
    const abortController = new AbortController();
    this.abortControllers.set(taskId, abortController);
    const { abortControllers } = this;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Emit working status
        const workingStatus: A2ATaskStatus = {
          state: "working",
          timestamp: nowIso(),
        };
        store.update(taskId, workingStatus);
        controller.enqueue(
          sseChunk({
            kind: "status-update",
            taskId,
            contextId,
            status: workingStatus,
          }),
        );

        try {
          let artifactIndex = 0;

          const eventStream = agent.runStreamEvents(prompt, {
            deps: deps as TDeps,
            messageHistory,
          });

          for await (const event of eventStream) {
            if (abortController.signal.aborted) break;

            if (event.kind === "text-delta") {
              // Stream artifact chunk
              const artifact: A2AArtifact = {
                artifactId: generateId(),
                name: "result",
                parts: [{ kind: "text", text: event.delta }],
                index: artifactIndex,
                append: artifactIndex > 0,
                lastChunk: false,
              };
              controller.enqueue(
                sseChunk({
                  kind: "artifact-update",
                  taskId,
                  contextId,
                  artifact,
                }),
              );
              artifactIndex++;
            } else if (event.kind === "final-result") {
              const finalArtifacts = outputToArtifacts(event.output);
              const agentMsg = agentMessage([outputToPart(event.output)]);
              const completedStatus: A2ATaskStatus = {
                state: "completed",
                timestamp: nowIso(),
              };
              store.update(taskId, completedStatus, {
                newMessages: [agentMsg],
                newArtifacts: finalArtifacts,
              });
              // Emit final artifact
              const finalArtifact: A2AArtifact = {
                ...finalArtifacts[0],
                index: artifactIndex,
                lastChunk: true,
              };
              controller.enqueue(
                sseChunk({
                  kind: "artifact-update",
                  taskId,
                  contextId,
                  artifact: finalArtifact,
                }),
              );
              // Emit completed status
              controller.enqueue(
                sseChunk({
                  kind: "status-update",
                  taskId,
                  contextId,
                  status: completedStatus,
                  final: true,
                }),
              );
            } else if (event.kind === "error") {
              const msg = event.error instanceof Error
                ? event.error.message
                : String(event.error);
              const failedStatus: A2ATaskStatus = {
                state: "failed",
                message: agentMessage([{ kind: "text", text: msg }]),
                timestamp: nowIso(),
              };
              store.update(taskId, failedStatus);
              controller.enqueue(
                sseChunk({
                  kind: "status-update",
                  taskId,
                  contextId,
                  status: failedStatus,
                  final: true,
                }),
              );
            }
          }

          // Handle cancellation
          if (abortController.signal.aborted) {
            const canceledStatus: A2ATaskStatus = {
              state: "canceled",
              timestamp: nowIso(),
            };
            store.update(taskId, canceledStatus);
            controller.enqueue(
              sseChunk({
                kind: "status-update",
                taskId,
                contextId,
                status: canceledStatus,
                final: true,
              }),
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const failedStatus: A2ATaskStatus = {
            state: "failed",
            message: agentMessage([{ kind: "text", text: msg }]),
            timestamp: nowIso(),
          };
          store.update(taskId, failedStatus);
          controller.enqueue(
            sseChunk({
              kind: "status-update",
              taskId,
              contextId,
              status: failedStatus,
              final: true,
            }),
          );
        } finally {
          abortControllers.delete(taskId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  private handleTaskGet(
    id: string | number | null,
    params: unknown,
  ): JsonRpcResponse<A2ATask> {
    let p: TaskGetParams;
    try {
      p = validateTaskGetParams(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid params";
      return rpcError(id, INVALID_PARAMS, msg);
    }

    const task = this.store.get(p.id);
    if (!task) {
      return rpcError(id, TASK_NOT_FOUND, `Task not found: ${p.id}`);
    }
    return ok(id, task);
  }

  private handleTaskCancel(
    id: string | number | null,
    params: unknown,
  ): JsonRpcResponse<A2ATask> {
    let p: TaskCancelParams;
    try {
      p = validateTaskCancelParams(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid params";
      return rpcError(id, INVALID_PARAMS, msg);
    }

    const task = this.store.get(p.id);
    if (!task) {
      return rpcError(id, TASK_NOT_FOUND, `Task not found: ${p.id}`);
    }

    // Signal abort to any running SSE stream for this task
    const ac = this.abortControllers.get(p.id);
    if (ac) {
      ac.abort();
    }

    const canceledStatus: A2ATaskStatus = {
      state: "canceled",
      timestamp: nowIso(),
    };
    const canceled = this.store.update(p.id, canceledStatus);
    return ok(id, canceled);
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateJsonRpc(raw: unknown): JsonRpcRequest {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Request must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj["jsonrpc"] !== "2.0") {
    throw new Error('jsonrpc must be "2.0"');
  }
  if (typeof obj["method"] !== "string") {
    throw new Error("method must be a string");
  }
  return obj as unknown as JsonRpcRequest;
}

function validateTaskSendParams(params: unknown): TaskSendParams {
  if (params === null || typeof params !== "object") {
    throw new Error("params must be an object");
  }
  const p = params as Record<string, unknown>;
  if (typeof p["id"] !== "string") throw new Error("id must be a string");
  if (p["message"] === null || typeof p["message"] !== "object") {
    throw new Error("message must be an object");
  }
  return p as unknown as TaskSendParams;
}

function validateTaskGetParams(params: unknown): TaskGetParams {
  if (params === null || typeof params !== "object") {
    throw new Error("params must be an object");
  }
  const p = params as Record<string, unknown>;
  if (typeof p["id"] !== "string") throw new Error("id must be a string");
  return { id: p["id"] };
}

function validateTaskCancelParams(params: unknown): TaskCancelParams {
  if (params === null || typeof params !== "object") {
    throw new Error("params must be an object");
  }
  const p = params as Record<string, unknown>;
  if (typeof p["id"] !== "string") throw new Error("id must be a string");
  return { id: p["id"] };
}
