import { MockLanguageModelV3, mockValues, convertArrayToReadableStream } from "ai/test";
import { createUsage } from "@vibes/framework";
import type { RunContext } from "@vibes/framework";
import type { CoreAgentDeps } from "../src/types.ts";

export { MockLanguageModelV3, mockValues, convertArrayToReadableStream };

export type DoGenerateResult = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>;

export function makeUsage() {
  return {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined },
    outputTokens: { total: 5, text: undefined, reasoning: undefined },
  };
}

export function textResponse(text: string): DoGenerateResult {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: makeUsage(),
    warnings: [],
  };
}

export function toolCallResponse(
  toolName: string,
  input: unknown,
  toolCallId = "tc1",
): DoGenerateResult {
  return {
    content: [{ type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage: makeUsage(),
    warnings: [],
  };
}

/** Create a temp dir, run fn with its path, then remove it. */
export async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "vibes_test_" });
  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

/** Build a CoreAgentDeps pointing at a given sandbox dir. */
export function makeDeps(sandboxRoot: string, workflowId = "test-wf"): CoreAgentDeps {
  // Override SANDBOX_ROOT by pointing contextDir at sandboxRoot directly.
  // The sandboxDir helper joins SANDBOX_ROOT/sandboxes/{id}, so we need
  // the actual sandbox path to equal sandboxRoot for write assertions to pass.
  return {
    workflowId,
    contextDir: sandboxRoot,
    runId: "test-run",
  };
}

/** Build a minimal RunContext<CoreAgentDeps>. */
export function makeCtx(deps: CoreAgentDeps): RunContext<CoreAgentDeps> {
  return {
    deps,
    usage: createUsage(),
    toolName: null,
    runId: "test-run-id",
    retryCount: 0,
    metadata: {},
  };
}
