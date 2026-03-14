import { assertEquals, assertExists } from "@std/assert";
import { MockLanguageModelV3, textResponse } from "./_helpers.ts";
import { Agent } from "../mod.ts";
import { A2AAdapter, MemoryTaskStore } from "../lib/a2a/mod.ts";
import type { A2AMessage, A2ATask, JsonRpcError, JsonRpcSuccess } from "../lib/a2a/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(model: MockLanguageModelV3, options: {
  name?: string;
  description?: string;
  url?: string;
} = {}) {
  const agent = new Agent({ model });
  return new A2AAdapter(agent, {
    name: options.name ?? "TestAgent",
    description: options.description,
    url: options.url ?? "http://localhost:9000",
    version: "1.0.0",
  });
}

function makeUserMessage(text: string, taskId?: string): A2AMessage {
  return {
    kind: "message",
    messageId: crypto.randomUUID(),
    role: "user",
    parts: [{ kind: "text", text }],
    taskId,
  };
}

async function rpcPost(
  adapter: A2AAdapter<undefined, string>,
  method: string,
  params: unknown,
  id: string | number = 1,
): Promise<Response> {
  const req = new Request("http://localhost:9000/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  return adapter.handleRequest(req);
}

// ---------------------------------------------------------------------------
// Agent card tests
// ---------------------------------------------------------------------------

Deno.test("A2A - agent card served at /.well-known/agent.json", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hello")),
  });
  const adapter = makeAdapter(model, {
    name: "MyAgent",
    url: "http://example.com",
  });

  const req = new Request("http://localhost:9000/.well-known/agent.json");
  const res = await adapter.handleRequest(req);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");

  const card = await res.json();
  assertEquals(card.name, "MyAgent");
  assertEquals(card.url, "http://example.com");
  assertEquals(card.version, "1.0.0");
  assertEquals(card.capabilities.streaming, true);
});

Deno.test("A2A - returns 404 for unknown paths", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hi")),
  });
  const adapter = makeAdapter(model);

  const req = new Request("http://localhost:9000/unknown");
  const res = await adapter.handleRequest(req);
  assertEquals(res.status, 404);
});

// ---------------------------------------------------------------------------
// tasks/send tests
// ---------------------------------------------------------------------------

Deno.test("A2A - tasks/send returns completed task with text output", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("Hello from agent!")),
  });
  const adapter = makeAdapter(model);

  const taskId = crypto.randomUUID();
  const res = await rpcPost(adapter, "tasks/send", {
    id: taskId,
    message: makeUserMessage("Say hello"),
  });

  assertEquals(res.status, 200);
  const body = (await res.json()) as JsonRpcSuccess<A2ATask>;
  assertEquals(body.jsonrpc, "2.0");
  assertEquals(body.id, 1);

  const task = body.result;
  assertEquals(task.kind, "task");
  assertEquals(task.id, taskId);
  assertEquals(task.status.state, "completed");
  assertExists(task.artifacts);
  assertEquals(task.artifacts!.length, 1);
  assertEquals(task.artifacts![0].parts[0].kind, "text");
  assertEquals(
    (task.artifacts![0].parts[0] as { kind: "text"; text: string }).text,
    "Hello from agent!",
  );
});

Deno.test("A2A - tasks/send also accepts message/send method alias", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("Hi!")),
  });
  const adapter = makeAdapter(model);

  const taskId = crypto.randomUUID();
  const res = await rpcPost(adapter, "message/send", {
    id: taskId,
    message: makeUserMessage("Hello"),
  });

  assertEquals(res.status, 200);
  const body = (await res.json()) as JsonRpcSuccess<A2ATask>;
  assertEquals(body.result.status.state, "completed");
});

Deno.test("A2A - tasks/send stores task history including agent response", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("I am fine")),
  });
  const store = new MemoryTaskStore();
  const agent = new Agent({ model });
  const adapter = new A2AAdapter(agent, { taskStore: store });

  const taskId = crypto.randomUUID();
  await rpcPost(adapter, "tasks/send", {
    id: taskId,
    message: makeUserMessage("How are you?"),
  });

  const task = store.get(taskId);
  assertExists(task);
  // history: [user message, agent message]
  assertEquals(task!.history!.length, 2);
  assertEquals(task!.history![0].role, "user");
  assertEquals(task!.history![1].role, "agent");
});

// ---------------------------------------------------------------------------
// tasks/get tests
// ---------------------------------------------------------------------------

Deno.test("A2A - tasks/get retrieves an existing task", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("Done")),
  });
  const adapter = makeAdapter(model);

  const taskId = crypto.randomUUID();
  // First create a task via tasks/send
  await rpcPost(adapter, "tasks/send", {
    id: taskId,
    message: makeUserMessage("Do something"),
  });

  // Now retrieve it
  const res = await rpcPost(adapter, "tasks/get", { id: taskId }, 2);
  assertEquals(res.status, 200);
  const body = (await res.json()) as JsonRpcSuccess<A2ATask>;
  assertEquals(body.result.id, taskId);
  assertEquals(body.result.status.state, "completed");
});

Deno.test("A2A - tasks/get returns TASK_NOT_FOUND error for unknown id", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hi")),
  });
  const adapter = makeAdapter(model);

  const res = await rpcPost(adapter, "tasks/get", { id: "nonexistent-id" });
  assertEquals(res.status, 200);
  const body = (await res.json()) as JsonRpcError;
  assertEquals(body.error.code, -32001); // TASK_NOT_FOUND
});

// ---------------------------------------------------------------------------
// tasks/cancel tests
// ---------------------------------------------------------------------------

Deno.test("A2A - tasks/cancel cancels a task that has been sent", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("result")),
  });
  const store = new MemoryTaskStore();
  const agent = new Agent({ model });
  const adapter = new A2AAdapter(agent, { taskStore: store });

  const taskId = crypto.randomUUID();
  // Create and complete task
  await rpcPost(adapter, "tasks/send", {
    id: taskId,
    message: makeUserMessage("Do work"),
  });

  // Cancel it (task is already completed, but cancel should still update status)
  const res = await rpcPost(adapter, "tasks/cancel", { id: taskId }, 2);
  assertEquals(res.status, 200);
  const body = (await res.json()) as JsonRpcSuccess<A2ATask>;
  assertEquals(body.result.status.state, "canceled");
});

Deno.test("A2A - tasks/cancel returns TASK_NOT_FOUND for unknown task", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hi")),
  });
  const adapter = makeAdapter(model);

  const res = await rpcPost(adapter, "tasks/cancel", { id: "no-such-task" });
  const body = (await res.json()) as JsonRpcError;
  assertEquals(body.error.code, -32001); // TASK_NOT_FOUND
});

// ---------------------------------------------------------------------------
// JSON-RPC error handling tests
// ---------------------------------------------------------------------------

Deno.test("A2A - invalid JSON returns parse error", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hi")),
  });
  const adapter = makeAdapter(model);

  const req = new Request("http://localhost:9000/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ not valid json !!!",
  });
  const res = await adapter.handleRequest(req);
  assertEquals(res.status, 200);
  const body = (await res.json()) as JsonRpcError;
  assertEquals(body.jsonrpc, "2.0");
  assertEquals(body.id, null);
  assertEquals(body.error.code, -32700); // PARSE_ERROR
});

Deno.test("A2A - unknown method returns METHOD_NOT_FOUND", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hi")),
  });
  const adapter = makeAdapter(model);

  const res = await rpcPost(adapter, "tasks/unknown", {});
  const body = (await res.json()) as JsonRpcError;
  assertEquals(body.error.code, -32601); // METHOD_NOT_FOUND
});

Deno.test("A2A - missing required params returns INVALID_PARAMS", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hi")),
  });
  const adapter = makeAdapter(model);

  // Missing 'id' field
  const res = await rpcPost(adapter, "tasks/send", {
    message: makeUserMessage("test"),
  });
  const body = (await res.json()) as JsonRpcError;
  assertEquals(body.error.code, -32602); // INVALID_PARAMS
});

Deno.test("A2A - wrong jsonrpc version returns parse error", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hi")),
  });
  const adapter = makeAdapter(model);

  const req = new Request("http://localhost:9000/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "1.0", id: 1, method: "tasks/send", params: {} }),
  });
  const res = await adapter.handleRequest(req);
  const body = (await res.json()) as JsonRpcError;
  assertEquals(body.error.code, -32700); // PARSE_ERROR
});

// ---------------------------------------------------------------------------
// MemoryTaskStore unit tests
// ---------------------------------------------------------------------------

Deno.test("MemoryTaskStore - create and get task", () => {
  const store = new MemoryTaskStore();
  const msg = makeUserMessage("hello");
  const task = store.create("task-1", "ctx-1", msg);

  assertEquals(task.id, "task-1");
  assertEquals(task.contextId, "ctx-1");
  assertEquals(task.status.state, "submitted");
  assertEquals(task.history!.length, 1);

  const retrieved = store.get("task-1");
  assertExists(retrieved);
  assertEquals(retrieved!.id, "task-1");
});

Deno.test("MemoryTaskStore - update task status", () => {
  const store = new MemoryTaskStore();
  const msg = makeUserMessage("do it");
  store.create("task-2", "ctx-2", msg);

  const updated = store.update("task-2", {
    state: "working",
    timestamp: new Date().toISOString(),
  });

  assertEquals(updated.status.state, "working");
});

Deno.test("MemoryTaskStore - update appends new messages and artifacts", () => {
  const store = new MemoryTaskStore();
  const msg = makeUserMessage("go");
  store.create("task-3", "ctx-3", msg);

  const agentMsg: A2AMessage = {
    kind: "message",
    messageId: "m2",
    role: "agent",
    parts: [{ kind: "text", text: "done" }],
  };

  const updated = store.update(
    "task-3",
    { state: "completed", timestamp: new Date().toISOString() },
    { newMessages: [agentMsg] },
  );

  assertEquals(updated.history!.length, 2);
  assertEquals(updated.history![1].role, "agent");
});

Deno.test("MemoryTaskStore - get returns undefined for unknown id", () => {
  const store = new MemoryTaskStore();
  assertEquals(store.get("nope"), undefined);
});

Deno.test("MemoryTaskStore - delete removes task", () => {
  const store = new MemoryTaskStore();
  store.create("task-del", "ctx-del", makeUserMessage("delete me"));
  assertExists(store.get("task-del"));
  store.delete("task-del");
  assertEquals(store.get("task-del"), undefined);
});
