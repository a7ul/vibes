import { assertEquals, assertExists } from "@std/assert";
import { AgentTaskStore } from "../src/agents/core_agent/toolsets/task_store.ts";
import { withTempDir } from "./_helpers.ts";

Deno.test("AgentTaskStore - create persists a task", async () => {
  await withTempDir(async (dir) => {
    const store = new AgentTaskStore(dir, "run1");
    const task = await store.create("test task", "general");

    assertExists(task.id);
    assertEquals(task.description, "test task");
    assertEquals(task.agentType, "general");
    assertEquals(task.status, "running");
    assertExists(task.startedAt);
  });
});

Deno.test("AgentTaskStore - get retrieves task by id", async () => {
  await withTempDir(async (dir) => {
    const store = new AgentTaskStore(dir, "run1");
    const created = await store.create("find me", "explore");
    const found = await store.get(created.id);

    assertExists(found);
    assertEquals(found!.description, "find me");
  });
});

Deno.test("AgentTaskStore - get returns undefined for unknown id", async () => {
  await withTempDir(async (dir) => {
    const store = new AgentTaskStore(dir, "run1");
    const found = await store.get("nonexistent");
    assertEquals(found, undefined);
  });
});

Deno.test("AgentTaskStore - listAll returns all tasks", async () => {
  await withTempDir(async (dir) => {
    const store = new AgentTaskStore(dir, "run1");
    await store.create("task a", "general");
    await store.create("task b", "plan");
    const tasks = await store.listAll();

    assertEquals(tasks.length, 2);
    assertEquals(tasks.map((t) => t.description).sort(), ["task a", "task b"]);
  });
});

Deno.test("AgentTaskStore - complete marks task done with output", async () => {
  await withTempDir(async (dir) => {
    const store = new AgentTaskStore(dir, "run1");
    const task = await store.create("complete me", "general");
    await store.complete(task.id, "all done", [{ role: "user" }]);

    const updated = await store.get(task.id);
    assertExists(updated);
    assertEquals(updated!.status, "completed");
    assertEquals(updated!.output, "all done");
    assertExists(updated!.completedAt);
    assertEquals((updated!.messageHistory as { role: string }[])[0].role, "user");
  });
});

Deno.test("AgentTaskStore - fail marks task failed with error", async () => {
  await withTempDir(async (dir) => {
    const store = new AgentTaskStore(dir, "run1");
    const task = await store.create("fail me", "general");
    await store.fail(task.id, "something went wrong");

    const updated = await store.get(task.id);
    assertExists(updated);
    assertEquals(updated!.status, "failed");
    assertEquals(updated!.error, "something went wrong");
    assertExists(updated!.completedAt);
  });
});

Deno.test("AgentTaskStore - isolates tasks by run id", async () => {
  await withTempDir(async (dir) => {
    const storeA = new AgentTaskStore(dir, "run-a");
    const storeB = new AgentTaskStore(dir, "run-b");

    await storeA.create("task in A", "general");
    const bTasks = await storeB.listAll();

    assertEquals(bTasks.length, 0);
  });
});
