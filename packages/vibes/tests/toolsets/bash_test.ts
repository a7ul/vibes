import { assertEquals, assertStringIncludes } from "@std/assert";
import { initSandbox, runInSandbox } from "../../src/sandbox.ts";
import { ensureSandboxDirs, sandboxDir } from "../../src/file_system.ts";
import { bashToolset } from "../../src/agents/core_agent/toolsets/bash.ts";
import { makeCtx } from "../_helpers.ts";
import type { CoreAgentDeps } from "../../src/types.ts";

const WF = "bash-test-wf";

// SandboxManager starts a persistent SOCKS5 proxy — disable resource/op sanitizers.
const T = { sanitizeResources: false, sanitizeOps: false };

async function setup() {
  await ensureSandboxDirs(WF);
  await initSandbox(sandboxDir(WF));
}

async function teardown() {
  await Deno.remove(sandboxDir(WF), { recursive: true }).catch(() => {});
}

Deno.test({ ...T, name: "runInSandbox - captures stdout", fn: async () => {
  await setup();
  try {
    const result = await runInSandbox("echo hello", sandboxDir(WF));
    assertStringIncludes(result.stdout, "hello");
    assertEquals(result.stderr, "");
  } finally {
    await teardown();
  }
}});

Deno.test({ ...T, name: "runInSandbox - captures stderr", fn: async () => {
  await setup();
  try {
    const result = await runInSandbox("echo err >&2", sandboxDir(WF));
    assertStringIncludes(result.stderr, "err");
  } finally {
    await teardown();
  }
}});

Deno.test({ ...T, name: "runInSandbox - handles non-zero exit gracefully", fn: async () => {
  await setup();
  try {
    const result = await runInSandbox("exit 1", sandboxDir(WF));
    assertEquals(typeof result.stdout, "string");
    assertEquals(typeof result.stderr, "string");
  } finally {
    await teardown();
  }
}});

Deno.test({ ...T, name: "runInSandbox - times out long-running command", fn: async () => {
  await setup();
  try {
    const result = await runInSandbox("sleep 60", sandboxDir(WF), 300);
    assertStringIncludes(result.stderr, "timed out");
  } finally {
    await teardown();
  }
}});

Deno.test({ ...T, name: "runInSandbox - parallel execution returns correct results", fn: async () => {
  await setup();
  try {
    const [a, b, c] = await Promise.all([
      runInSandbox("echo alpha", sandboxDir(WF)),
      runInSandbox("echo beta", sandboxDir(WF)),
      runInSandbox("echo gamma", sandboxDir(WF)),
    ]);
    assertStringIncludes(a.stdout, "alpha");
    assertStringIncludes(b.stdout, "beta");
    assertStringIncludes(c.stdout, "gamma");
  } finally {
    await teardown();
  }
}});

Deno.test({ ...T, name: "bulk_execute_bash_code_snippets - runs multiple snippets", fn: async () => {
  await setup();
  try {
    const deps: CoreAgentDeps = { workflowId: WF, contextDir: sandboxDir(WF), runId: "r" };
    const tool = bashToolset.tools().find((t) => t.name === "bulk_execute_bash_code_snippets")!;
    const results = await tool.execute(makeCtx(deps), { codes: ["echo one", "echo two", "echo three"] }) as Array<{ stdout: string }>;

    assertEquals(results.length, 3);
    assertStringIncludes(results[0].stdout, "one");
    assertStringIncludes(results[1].stdout, "two");
    assertStringIncludes(results[2].stdout, "three");
  } finally {
    await teardown();
  }
}});

Deno.test({ ...T, name: "bulk_execute_bash_code_snippets - captures independent stderr", fn: async () => {
  await setup();
  try {
    const deps: CoreAgentDeps = { workflowId: WF, contextDir: sandboxDir(WF), runId: "r" };
    const tool = bashToolset.tools().find((t) => t.name === "bulk_execute_bash_code_snippets")!;
    const results = await tool.execute(makeCtx(deps), { codes: ["echo out", "echo err >&2"] }) as Array<{ stdout: string; stderr: string }>;

    assertStringIncludes(results[0].stdout, "out");
    assertStringIncludes(results[1].stderr, "err");
  } finally {
    await teardown();
  }
}});
