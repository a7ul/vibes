import { assertEquals } from "@std/assert";
import {
  Agent,
  InMemoryStore,
  MemoryToolset,
  type MemoryStore,
} from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// InMemoryStore unit tests
// ---------------------------------------------------------------------------

Deno.test("InMemoryStore - save returns memory with timestamps", async () => {
  const store = new InMemoryStore();
  const memory = await store.save("user_name", "Alice", ["user"]);
  assertEquals(memory.key, "user_name");
  assertEquals(memory.content, "Alice");
  assertEquals(memory.tags, ["user"]);
});

Deno.test("InMemoryStore - save upserts by key", async () => {
  const store = new InMemoryStore();
  const first = await store.save("lang", "TypeScript");
  const second = await store.save("lang", "Deno");
  assertEquals(second.content, "Deno");
  assertEquals(second.createdAt, first.createdAt);
});

Deno.test("InMemoryStore - recall returns memory for known key", async () => {
  const store = new InMemoryStore();
  await store.save("color", "blue");
  const memory = await store.recall("color");
  assertEquals(memory?.content, "blue");
});

Deno.test("InMemoryStore - recall returns null for unknown key", async () => {
  const store = new InMemoryStore();
  const memory = await store.recall("nope");
  assertEquals(memory, null);
});

Deno.test("InMemoryStore - search matches key", async () => {
  const store = new InMemoryStore();
  await store.save("user_preference", "dark mode");
  const results = await store.search("preference");
  assertEquals(results.length, 1);
  assertEquals(results[0].key, "user_preference");
});

Deno.test("InMemoryStore - search matches content", async () => {
  const store = new InMemoryStore();
  await store.save("setting", "dark mode enabled");
  const results = await store.search("dark mode");
  assertEquals(results.length, 1);
});

Deno.test("InMemoryStore - search matches tags", async () => {
  const store = new InMemoryStore();
  await store.save("font_size", "16px", ["ui", "preference"]);
  const results = await store.search("preference");
  assertEquals(results.length, 1);
  assertEquals(results[0].key, "font_size");
});

Deno.test("InMemoryStore - search is case-insensitive", async () => {
  const store = new InMemoryStore();
  await store.save("theme", "Dark Mode");
  const results = await store.search("dark mode");
  assertEquals(results.length, 1);
});

Deno.test("InMemoryStore - search returns empty array when no match", async () => {
  const store = new InMemoryStore();
  await store.save("key1", "some content");
  const results = await store.search("zzz");
  assertEquals(results.length, 0);
});

Deno.test("InMemoryStore - delete removes existing memory", async () => {
  const store = new InMemoryStore();
  await store.save("temp", "value");
  const removed = await store.delete("temp");
  assertEquals(removed, true);
  assertEquals(await store.recall("temp"), null);
});

Deno.test("InMemoryStore - delete returns false for unknown key", async () => {
  const store = new InMemoryStore();
  const removed = await store.delete("ghost");
  assertEquals(removed, false);
});

Deno.test("InMemoryStore - list returns keys and tags only", async () => {
  const store = new InMemoryStore();
  await store.save("a", "content a", ["tag1"]);
  await store.save("b", "content b", ["tag2", "tag3"]);
  const entries = await store.list();
  assertEquals(entries.length, 2);
  const keys = entries.map((e) => e.key).sort();
  assertEquals(keys, ["a", "b"]);
  const entryA = entries.find((e) => e.key === "a")!;
  assertEquals(entryA.tags, ["tag1"]);
  // list does not include content
  assertEquals("content" in entryA, false);
});

Deno.test("InMemoryStore - list returns empty array when no memories", async () => {
  const store = new InMemoryStore();
  const entries = await store.list();
  assertEquals(entries.length, 0);
});

Deno.test("InMemoryStore - save defaults to empty tags", async () => {
  const store = new InMemoryStore();
  const memory = await store.save("key", "value");
  assertEquals(memory.tags, []);
});

// ---------------------------------------------------------------------------
// MemoryToolset tool exposure tests
// ---------------------------------------------------------------------------

Deno.test("MemoryToolset - exposes five tools to agent", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = (opts.tools ?? []).map((t: { name: string }) => t.name);
      return Promise.resolve(textResponse("done"));
    },
  });

  const agent = new Agent({ model, toolsets: [new MemoryToolset()] });
  await agent.run("help");

  assertEquals(capturedNames.includes("memory_save"), true);
  assertEquals(capturedNames.includes("memory_recall"), true);
  assertEquals(capturedNames.includes("memory_search"), true);
  assertEquals(capturedNames.includes("memory_delete"), true);
  assertEquals(capturedNames.includes("memory_list"), true);
});

// ---------------------------------------------------------------------------
// MemoryToolset tool execution tests (direct execute calls)
// ---------------------------------------------------------------------------

function getTools(store?: MemoryStore) {
  const ts = new MemoryToolset(store);
  return ts.tools(null as never);
}

Deno.test("MemoryToolset - memory_save stores a memory", async () => {
  const store = new InMemoryStore();
  const tools = await getTools(store);
  const saveTool = tools.find((t) => t.name === "memory_save")!;

  const raw = await saveTool.execute(null as never, {
    key: "user_name",
    content: "Alice",
    tags: ["user"],
  });
  const result = JSON.parse(raw as string);
  assertEquals(result.key, "user_name");
  assertEquals(result.content, "Alice");
  assertEquals(result.tags, ["user"]);
});

Deno.test("MemoryToolset - memory_recall retrieves saved memory", async () => {
  const store = new InMemoryStore();
  await store.save("theme", "dark");
  const tools = await getTools(store);
  const recallTool = tools.find((t) => t.name === "memory_recall")!;

  const raw = await recallTool.execute(null as never, { key: "theme" });
  const result = JSON.parse(raw as string);
  assertEquals(result.content, "dark");
});

Deno.test("MemoryToolset - memory_recall returns null for unknown key", async () => {
  const store = new InMemoryStore();
  const tools = await getTools(store);
  const recallTool = tools.find((t) => t.name === "memory_recall")!;

  const raw = await recallTool.execute(null as never, { key: "missing" });
  const result = JSON.parse(raw as string);
  assertEquals(result, null);
});

Deno.test("MemoryToolset - memory_search finds matching memories", async () => {
  const store = new InMemoryStore();
  await store.save("user_lang", "TypeScript", ["user"]);
  await store.save("system_lang", "English");
  const tools = await getTools(store);
  const searchTool = tools.find((t) => t.name === "memory_search")!;

  const raw = await searchTool.execute(null as never, { query: "user" });
  const results = JSON.parse(raw as string);
  assertEquals(results.length, 1);
  assertEquals(results[0].key, "user_lang");
});

Deno.test("MemoryToolset - memory_delete removes memory", async () => {
  const store = new InMemoryStore();
  await store.save("temp", "value");
  const tools = await getTools(store);
  const deleteTool = tools.find((t) => t.name === "memory_delete")!;

  const raw = await deleteTool.execute(null as never, { key: "temp" });
  const result = JSON.parse(raw as string);
  assertEquals(result.removed, true);
  assertEquals(await store.recall("temp"), null);
});

Deno.test("MemoryToolset - memory_delete returns false for unknown key", async () => {
  const store = new InMemoryStore();
  const tools = await getTools(store);
  const deleteTool = tools.find((t) => t.name === "memory_delete")!;

  const raw = await deleteTool.execute(null as never, { key: "ghost" });
  const result = JSON.parse(raw as string);
  assertEquals(result.removed, false);
});

Deno.test("MemoryToolset - memory_list returns keys and tags", async () => {
  const store = new InMemoryStore();
  await store.save("a", "content a", ["t1"]);
  await store.save("b", "content b");
  const tools = await getTools(store);
  const listTool = tools.find((t) => t.name === "memory_list")!;

  const raw = await listTool.execute(null as never, {});
  const entries = JSON.parse(raw as string);
  assertEquals(entries.length, 2);
});

Deno.test("MemoryToolset - uses InMemoryStore by default", async () => {
  const ts = new MemoryToolset();
  const tools = ts.tools(null as never);
  const saveTool = tools.find((t) => t.name === "memory_save")!;
  const raw = await saveTool.execute(null as never, { key: "test", content: "value" });
  const result = JSON.parse(raw as string);
  assertEquals(result.key, "test");
  assertEquals(result.content, "value");
});

// ---------------------------------------------------------------------------
// MemoryToolset integration with Agent (no real API calls)
// ---------------------------------------------------------------------------

Deno.test("MemoryToolset - agent can call memory_save via model", async () => {
  let memorySaved = false;
  const store: MemoryStore = {
    save: (key, content, tags) => {
      memorySaved = true;
      return Promise.resolve({ key, content, tags: tags ?? [], createdAt: new Date(), updatedAt: new Date() });
    },
    recall: () => Promise.resolve(null),
    search: () => Promise.resolve([]),
    delete: () => Promise.resolve(false),
    list: () => Promise.resolve([]),
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("memory_save", { key: "user_goal", content: "ship the feature" }),
    textResponse("done"),
  );

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [new MemoryToolset(store)] });
  await agent.run("remember my goal");

  assertEquals(memorySaved, true);
});
