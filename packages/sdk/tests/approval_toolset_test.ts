/**
 * Tests for ApprovalRequiredToolset - wraps a toolset and marks all tools
 * as requiring human approval before execution.
 */
import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  Agent,
  ApprovalRequiredError,
  ApprovalRequiredToolset,
  type DeferredToolResults,
  FunctionToolset,
  tool,
} from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

function makeTool(name: string, description = `${name} tool`) {
  return tool({
    name,
    description,
    parameters: z.object({ input: z.string() }),
    execute: (_ctx, args) => Promise.resolve(`${name}: ${args.input}`),
  });
}

Deno.test("ApprovalRequiredToolset - all tools require approval", async () => {
  const inner = new FunctionToolset([makeTool("search"), makeTool("fetch")]);
  const wrapped = new ApprovalRequiredToolset(inner);
  const agent = new Agent({
    model: new MockLanguageModelV3({
      doGenerate: () =>
        Promise.resolve(toolCallResponse("search", { input: "test" })),
    }),
    toolsets: [wrapped],
  });

  let caught: ApprovalRequiredError | null = null;
  try {
    await agent.run("search something");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) caught = err;
    else throw err;
  }

  assertInstanceOf(caught, ApprovalRequiredError);
  assertEquals(caught!.deferred.requests[0].toolName, "search");
});

Deno.test("ApprovalRequiredToolset - resume works after approval", async () => {
  const inner = new FunctionToolset([makeTool("search")]);
  const wrapped = new ApprovalRequiredToolset(inner);

  const firstCall = mockValues<DoGenerateResult>(
    toolCallResponse("search", { input: "test" }, "tc-search"),
  );
  const secondCall = mockValues<DoGenerateResult>(
    textResponse("Search completed"),
  );
  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? firstCall() : secondCall());
    },
  });

  const agent = new Agent({ model, toolsets: [wrapped] });

  let deferredErr: ApprovalRequiredError | null = null;
  try {
    await agent.run("search something");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) deferredErr = err;
    else throw err;
  }

  assertInstanceOf(deferredErr, ApprovalRequiredError);

  const results: DeferredToolResults = {
    results: [
      {
        toolCallId: deferredErr!.deferred.requests[0].toolCallId,
        result: "search results: [result1, result2]",
      },
    ],
  };

  const finalResult = await agent.resume(deferredErr!.deferred, results);
  assertEquals(finalResult.output, "Search completed");
  assertEquals(callCount, 2);
});

Deno.test("ApprovalRequiredToolset - marks all inner tools as requiresApproval", async () => {
  const inner = new FunctionToolset([makeTool("tool_a"), makeTool("tool_b")]);
  const wrapped = new ApprovalRequiredToolset(inner);

  // Resolve the tools and check requiresApproval flag
  const ctx = {
    deps: undefined as undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test-run",
    conversationId: "test-conversation",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  const tools = await wrapped.tools(ctx);
  assertEquals(tools.length, 2);
  assertEquals(tools.every((t) => t.requiresApproval === true), true);
});

Deno.test("ApprovalRequiredToolset - original tool execute is preserved", async () => {
  let executed = false;
  const myTool = tool({
    name: "my_tool",
    description: "My tool",
    parameters: z.object({}),
    execute: () => {
      executed = true;
      return Promise.resolve("executed");
    },
  });

  const inner = new FunctionToolset([myTool]);
  const wrapped = new ApprovalRequiredToolset(inner);

  const ctx = {
    deps: undefined as undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test-run",
    conversationId: "test-conversation",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  const tools = await wrapped.tools(ctx);
  assertEquals(tools.length, 1);

  // Execute the wrapped tool's execute (should call the original)
  await tools[0].execute(ctx, {});
  assertEquals(executed, true);
});
