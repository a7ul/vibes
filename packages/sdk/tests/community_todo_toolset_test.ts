import { assertEquals, assertRejects } from "@std/assert";
import {
  Agent,
  TodoToolset,
  MemoryTodoStore,
  type TodoStore,
} from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// MemoryTodoStore unit tests
// ---------------------------------------------------------------------------

Deno.test("MemoryTodoStore - add returns todo with auto-assigned id", async () => {
  const store = new MemoryTodoStore();
  const todo = await store.add({ title: "Buy milk", status: "pending", dependsOn: [] });
  assertEquals(todo.id, "1");
  assertEquals(todo.title, "Buy milk");
  assertEquals(todo.status, "pending");
  assertEquals(todo.dependsOn, []);
});

Deno.test("MemoryTodoStore - ids increment", async () => {
  const store = new MemoryTodoStore();
  const a = await store.add({ title: "A", status: "pending", dependsOn: [] });
  const b = await store.add({ title: "B", status: "pending", dependsOn: [] });
  assertEquals(a.id, "1");
  assertEquals(b.id, "2");
});

Deno.test("MemoryTodoStore - list returns all todos when no filter", async () => {
  const store = new MemoryTodoStore();
  await store.add({ title: "A", status: "pending", dependsOn: [] });
  await store.add({ title: "B", status: "done", dependsOn: [] });
  const all = await store.list();
  assertEquals(all.length, 2);
});

Deno.test("MemoryTodoStore - list filters by status", async () => {
  const store = new MemoryTodoStore();
  await store.add({ title: "A", status: "pending", dependsOn: [] });
  await store.add({ title: "B", status: "done", dependsOn: [] });
  const pending = await store.list({ status: "pending" });
  assertEquals(pending.length, 1);
  assertEquals(pending[0].title, "A");
});

Deno.test("MemoryTodoStore - update changes status", async () => {
  const store = new MemoryTodoStore();
  const todo = await store.add({ title: "Task", status: "pending", dependsOn: [] });
  const updated = await store.update(todo.id, "in_progress");
  assertEquals(updated.status, "in_progress");
  assertEquals(updated.id, todo.id);
});

Deno.test("MemoryTodoStore - update throws on unknown id", async () => {
  const store = new MemoryTodoStore();
  await assertRejects(
    () => store.update("999", "done"),
    Error,
    "Todo not found: 999",
  );
});

Deno.test("MemoryTodoStore - clear removes done and cancelled todos", async () => {
  const store = new MemoryTodoStore();
  await store.add({ title: "Keep", status: "pending", dependsOn: [] });
  const done = await store.add({ title: "Done", status: "pending", dependsOn: [] });
  const cancelled = await store.add({ title: "Cancelled", status: "pending", dependsOn: [] });
  await store.update(done.id, "done");
  await store.update(cancelled.id, "cancelled");

  await store.clear();
  const remaining = await store.list();
  assertEquals(remaining.length, 1);
  assertEquals(remaining[0].title, "Keep");
});

Deno.test("MemoryTodoStore - add preserves parentId and dependsOn", async () => {
  const store = new MemoryTodoStore();
  const parent = await store.add({ title: "Parent", status: "pending", dependsOn: [] });
  const child = await store.add({
    title: "Child",
    status: "pending",
    parentId: parent.id,
    dependsOn: [parent.id],
  });
  assertEquals(child.parentId, parent.id);
  assertEquals(child.dependsOn, [parent.id]);
});

// ---------------------------------------------------------------------------
// TodoToolset tool exposure tests
// ---------------------------------------------------------------------------

Deno.test("TodoToolset - exposes four tools to agent", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = (opts.tools ?? []).map((t: { name: string }) => t.name);
      return Promise.resolve(textResponse("done"));
    },
  });

  const agent = new Agent({ model, toolsets: [new TodoToolset()] });
  await agent.run("help");

  assertEquals(capturedNames.includes("todo_add"), true);
  assertEquals(capturedNames.includes("todo_list"), true);
  assertEquals(capturedNames.includes("todo_update"), true);
  assertEquals(capturedNames.includes("todo_clear"), true);
});

// ---------------------------------------------------------------------------
// TodoToolset tool execution tests (direct execute calls)
// ---------------------------------------------------------------------------

function getTools(store?: TodoStore) {
  const ts = new TodoToolset(store);
  // Pass a stub context (tools() ignores it)
  return ts.tools(null as never);
}

Deno.test("TodoToolset - todo_add creates a todo", async () => {
  const store = new MemoryTodoStore();
  const tools = await getTools(store);
  const addTool = tools.find((t) => t.name === "todo_add")!;

  const raw = await addTool.execute(null as never, {
    title: "Write tests",
    dependsOn: [],
  });
  const result = JSON.parse(raw as string);
  assertEquals(result.title, "Write tests");
  assertEquals(result.status, "pending");
  assertEquals(result.id, "1");
});

Deno.test("TodoToolset - todo_list returns todos", async () => {
  const store = new MemoryTodoStore();
  await store.add({ title: "A", status: "pending", dependsOn: [] });
  await store.add({ title: "B", status: "done", dependsOn: [] });

  const tools = await getTools(store);
  const listTool = tools.find((t) => t.name === "todo_list")!;

  const allRaw = await listTool.execute(null as never, {});
  const all = JSON.parse(allRaw as string);
  assertEquals(all.length, 2);

  const filteredRaw = await listTool.execute(null as never, { status: "done" });
  const filtered = JSON.parse(filteredRaw as string);
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].title, "B");
});

Deno.test("TodoToolset - todo_update changes status", async () => {
  const store = new MemoryTodoStore();
  const todo = await store.add({ title: "Task", status: "pending", dependsOn: [] });

  const tools = await getTools(store);
  const updateTool = tools.find((t) => t.name === "todo_update")!;

  const raw = await updateTool.execute(null as never, {
    id: todo.id,
    status: "in_progress",
  });
  const result = JSON.parse(raw as string);
  assertEquals(result.status, "in_progress");
});

Deno.test("TodoToolset - todo_clear removes completed todos", async () => {
  const store = new MemoryTodoStore();
  await store.add({ title: "Keep", status: "pending", dependsOn: [] });
  const done = await store.add({ title: "Done", status: "pending", dependsOn: [] });
  await store.update(done.id, "done");

  const tools = await getTools(store);
  const clearTool = tools.find((t) => t.name === "todo_clear")!;

  await clearTool.execute(null as never, {});
  const remaining = await store.list();
  assertEquals(remaining.length, 1);
  assertEquals(remaining[0].title, "Keep");
});

Deno.test("TodoToolset - uses MemoryTodoStore by default", async () => {
  const ts = new TodoToolset();
  const tools = ts.tools(null as never);
  const addTool = tools.find((t) => t.name === "todo_add")!;
  const raw = await addTool.execute(null as never, { title: "Default store" });
  const result = JSON.parse(raw as string);
  assertEquals(result.title, "Default store");
});

// ---------------------------------------------------------------------------
// TodoToolset integration with Agent (no real API calls)
// ---------------------------------------------------------------------------

Deno.test("TodoToolset - agent can call todo_add via model", async () => {
  let todoAdded = false;
  const store: TodoStore = {
    add: (todo) => {
      todoAdded = true;
      return Promise.resolve({ ...todo, id: "1", createdAt: new Date(), updatedAt: new Date() });
    },
    list: () => Promise.resolve([]),
    update: (_id, _status) => { throw new Error("unexpected update"); },
    clear: () => Promise.resolve(),
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("todo_add", { title: "Ship feature", dependsOn: [] }),
    textResponse("done"),
  );

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [new TodoToolset(store)] });
  await agent.run("add a todo");

  assertEquals(todoAdded, true);
});
