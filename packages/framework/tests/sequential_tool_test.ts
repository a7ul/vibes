import { assertEquals } from "@std/assert";
import { Agent, tool } from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

Deno.test("sequential tool - isOutput flag not set on regular tool", () => {
  const t = tool({
    name: "normal",
    description: "Normal tool",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async () => "ok",
  });
  assertEquals(t.sequential, undefined);
});

Deno.test("sequential tool - sequential flag is stored on ToolDefinition", () => {
  const t = tool({
    name: "seq",
    description: "Sequential tool",
    parameters: z.object({}),
    sequential: true,
    // deno-lint-ignore require-await
    execute: async () => "ok",
  });
  assertEquals(t.sequential, true);
});

Deno.test("sequential tool - sequential tool executes correctly when alone", async () => {
  let executed = false;
  const seqTool = tool({
    name: "seq_tool",
    description: "Sequential tool",
    parameters: z.object({ value: z.number() }),
    sequential: true,
    // deno-lint-ignore require-await
    execute: async (_ctx, args) => {
      executed = true;
      return String(args.value * 2);
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("seq_tool", { value: 5 }),
    textResponse("result is 10"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [seqTool] });
  const result = await agent.run("double 5");
  assertEquals(executed, true);
  assertEquals(result.output.includes("10"), true);
});

Deno.test("sequential tool - sequential tools serialize overlapping calls", async () => {
  const executionOrder: string[] = [];

  // Simulate two sequential tools that both take time
  const makeSeqTool = (name: string, delay: number) =>
    tool({
      name,
      description: `Sequential tool ${name}`,
      parameters: z.object({}),
      sequential: true,
      execute: async () => {
        executionOrder.push(`start:${name}`);
        await new Promise((r) => setTimeout(r, delay));
        executionOrder.push(`end:${name}`);
        return name;
      },
    });

  const toolA = makeSeqTool("tool_a", 20);
  const toolB = makeSeqTool("tool_b", 10);

  // Both are called in the same response (parallel by default in AI SDK)
  // but sequential flag means they'll be serialized
  const responses = mockValues<DoGenerateResult>(
    // Return both tool calls in one response (AI SDK will call them in parallel)
    {
      content: [
        {
          type: "tool-call",
          toolCallId: "tc1",
          toolName: "tool_a",
          input: JSON.stringify({}),
        },
        {
          type: "tool-call",
          toolCallId: "tc2",
          toolName: "tool_b",
          input: JSON.stringify({}),
        },
      ],
      finishReason: { unified: "tool-calls" as const, raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: 0,
          cacheWrite: undefined,
        },
        outputTokens: { total: 5, text: undefined, reasoning: undefined },
      },
      warnings: [],
    },
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [toolA, toolB] });
  await agent.run("run both");

  // With sequential mutex, one must complete before the other starts
  // Find where tool_b or tool_a ends and the other starts
  const startA = executionOrder.indexOf("start:tool_a");
  const endA = executionOrder.indexOf("end:tool_a");
  const startB = executionOrder.indexOf("start:tool_b");
  const endB = executionOrder.indexOf("end:tool_b");

  // Either A finishes before B starts, or B finishes before A starts
  const aBeforeB = endA < startB;
  const bBeforeA = endB < startA;
  assertEquals(
    aBeforeB || bBeforeA,
    true,
    `executionOrder: ${executionOrder.join(", ")}`,
  );
});

Deno.test("sequential tool - non-sequential tools are not affected by sequential mutex", async () => {
  // Non-sequential tools should still run in parallel
  const executionLog: string[] = [];

  const slowTool = tool({
    name: "slow",
    description: "Slow non-sequential tool",
    parameters: z.object({}),
    // sequential: false (default)
    execute: async () => {
      executionLog.push("slow:start");
      await new Promise((r) => setTimeout(r, 20));
      executionLog.push("slow:end");
      return "slow";
    },
  });

  const fastTool = tool({
    name: "fast",
    description: "Fast non-sequential tool",
    parameters: z.object({}),
    execute: async () => {
      executionLog.push("fast:start");
      await new Promise((r) => setTimeout(r, 5));
      executionLog.push("fast:end");
      return "fast";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    {
      content: [
        {
          type: "tool-call",
          toolCallId: "tc1",
          toolName: "slow",
          input: JSON.stringify({}),
        },
        {
          type: "tool-call",
          toolCallId: "tc2",
          toolName: "fast",
          input: JSON.stringify({}),
        },
      ],
      finishReason: { unified: "tool-calls" as const, raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: 0,
          cacheWrite: undefined,
        },
        outputTokens: { total: 5, text: undefined, reasoning: undefined },
      },
      warnings: [],
    },
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [slowTool, fastTool] });
  await agent.run("run both");

  // Non-sequential tools should interleave: fast should start after slow and may end before slow
  // (AI SDK calls them in parallel so both start, but fast finishes first)
  const slowStart = executionLog.indexOf("slow:start");
  const fastStart = executionLog.indexOf("fast:start");
  const slowEnd = executionLog.indexOf("slow:end");
  const fastEnd = executionLog.indexOf("fast:end");

  // Both should have started before either ended (indicates parallel execution)
  // At minimum, both start before slow ends
  assertEquals(slowStart >= 0, true);
  assertEquals(fastStart >= 0, true);
  assertEquals(
    fastEnd < slowEnd,
    true,
    `fast should end before slow: ${executionLog.join(", ")}`,
  );
});
