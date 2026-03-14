import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { filesToolset } from "../../src/agents/core_agent/toolsets/files.ts";
import { initSandbox } from "../../src/sandbox.ts";
import { ensureSandboxDirs, sandboxDir } from "../../src/file_system.ts";
import { makeCtx } from "../_helpers.ts";
import type { CoreAgentDeps } from "../../src/types.ts";

const WF = "files-test-wf";
// SandboxManager starts a persistent SOCKS5 proxy - disable resource/op sanitizers.
const T = { sanitizeResources: false, sanitizeOps: false };

async function setup() {
  await ensureSandboxDirs(WF);
  await initSandbox(sandboxDir(WF));
}

async function teardown() {
  await Deno.remove(sandboxDir(WF), { recursive: true }).catch(() => {});
}

function makeDeps(): CoreAgentDeps {
  return { workflowId: WF, contextDir: sandboxDir(WF), runId: "r" };
}

function getTool(name: string) {
  const t = filesToolset.tools().find((t) => t.name === name);
  if (!t) throw new Error(`Tool ${name} not found`);
  return t;
}

Deno.test({ ...T, name: "write_file - creates file with content", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    const filePath = join(sandboxDir(WF), "hello.txt");
    const result = await getTool("write_file").execute(makeCtx(deps), { file_path: filePath, content: "hello world" });
    assertEquals(result, `Wrote ${filePath}`);
    assertEquals(await Deno.readTextFile(filePath), "hello world");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "write_file - creates parent directories", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    const filePath = join(sandboxDir(WF), "nested", "dir", "file.txt");
    await getTool("write_file").execute(makeCtx(deps), { file_path: filePath, content: "nested" });
    assertEquals(await Deno.readTextFile(filePath), "nested");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "write_file - rejects path outside sandbox", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    let threw = false;
    try {
      await getTool("write_file").execute(makeCtx(deps), { file_path: "/tmp/evil.txt", content: "bad" });
    } catch { threw = true; }
    assertEquals(threw, true);
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "edit_file - replaces unique occurrence", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    const filePath = join(sandboxDir(WF), "edit.txt");
    await Deno.writeTextFile(filePath, "foo bar baz");
    const result = await getTool("edit_file").execute(makeCtx(deps), { file_path: filePath, old_text: "bar", new_text: "qux" });
    assertEquals(result, `Edited ${filePath}`);
    assertEquals(await Deno.readTextFile(filePath), "foo qux baz");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "edit_file - rejects missing old_text", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    const filePath = join(sandboxDir(WF), "edit.txt");
    await Deno.writeTextFile(filePath, "foo bar baz");
    const result = await getTool("edit_file").execute(makeCtx(deps), { file_path: filePath, old_text: "zzz", new_text: "qux" });
    assertEquals(result, "old_text not found in file.");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "edit_file - rejects non-unique old_text", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    const filePath = join(sandboxDir(WF), "dup.txt");
    await Deno.writeTextFile(filePath, "foo foo foo");
    const result = await getTool("edit_file").execute(makeCtx(deps), { file_path: filePath, old_text: "foo", new_text: "bar" });
    assertStringIncludes(result as string, "matches 3 locations");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "edit_file - returns error for missing file", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    const result = await getTool("edit_file").execute(makeCtx(deps), { file_path: join(sandboxDir(WF), "nonexistent.txt"), old_text: "x", new_text: "y" });
    assertStringIncludes(result as string, "File not found");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "read_file - returns numbered lines", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    const filePath = join(sandboxDir(WF), "lines.txt");
    await Deno.writeTextFile(filePath, "alpha\nbeta\ngamma");
    const result = await getTool("read_file").execute(makeCtx(deps), { file_path: filePath, offset: 0, limit: 0 });
    const text = JSON.stringify(result);
    assertStringIncludes(text, "alpha");
    assertStringIncludes(text, "beta");
    assertStringIncludes(text, "gamma");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "glob_files - finds matching files", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    await Deno.writeTextFile(join(sandboxDir(WF), "a.ts"), "");
    await Deno.writeTextFile(join(sandboxDir(WF), "b.ts"), "");
    await Deno.writeTextFile(join(sandboxDir(WF), "c.md"), "");
    const result = await getTool("glob_files").execute(makeCtx(deps), { pattern: "*.ts", path: sandboxDir(WF) });
    const text = JSON.stringify(result);
    assertStringIncludes(text, "a.ts");
    assertStringIncludes(text, "b.ts");
  } finally { await teardown(); }
}});

Deno.test({ ...T, name: "grep_files - finds pattern in files", fn: async () => {
  await setup();
  try {
    const deps = makeDeps();
    await Deno.writeTextFile(join(sandboxDir(WF), "needle.txt"), "hello vibes\nignored line");
    const result = await getTool("grep_files").execute(makeCtx(deps), { pattern: "vibes", path: sandboxDir(WF), include: "" });
    assertStringIncludes(JSON.stringify(result), "hello vibes");
  } finally { await teardown(); }
}});
