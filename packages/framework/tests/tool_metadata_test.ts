import { assertEquals } from "@std/assert";
import { Agent, type RunContext, tool } from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

Deno.test("toolResultMetadata - attachMetadata is available on RunContext", async () => {
  let capturedCtx: RunContext<undefined> | null = null;

  const myTool = tool({
    name: "inspect",
    description: "Inspect context",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async (ctx) => {
      capturedCtx = ctx;
      return "ok";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("inspect", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("inspect");

  const ctx = capturedCtx as unknown as RunContext<undefined>;
  assertEquals(typeof ctx.attachMetadata, "function");
  assertEquals(ctx.toolResultMetadata instanceof Map, true);
});

Deno.test("toolResultMetadata - attachMetadata stores metadata on context", async () => {
  const myTool = tool({
    name: "annotate",
    description: "Annotate with metadata",
    parameters: z.object({ key: z.string() }),
    // deno-lint-ignore require-await
    execute: async (ctx, args) => {
      ctx.attachMetadata("manual-call-1", { key: args.key, ts: 123 });
      return "annotated";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("annotate", { key: "foo" }),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [myTool] });
  const result = await agent.run("annotate");

  // toolMetadata on RunResult should have the entry
  assertEquals(result.toolMetadata.has("manual-call-1"), true);
  const meta = result.toolMetadata.get("manual-call-1");
  assertEquals(meta?.key, "foo");
  assertEquals(meta?.ts, 123);
});

Deno.test("toolResultMetadata - metadata from multiple tool calls is collected", async () => {
  const myTool = tool({
    name: "tag",
    description: "Tag with metadata",
    parameters: z.object({ label: z.string() }),
    // deno-lint-ignore require-await
    execute: async (ctx, args) => {
      ctx.attachMetadata(`call-${args.label}`, { label: args.label });
      return `tagged-${args.label}`;
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("tag", { label: "a" }, "tc-a"),
    toolCallResponse("tag", { label: "b" }, "tc-b"),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [myTool] });
  const result = await agent.run("tag things");

  assertEquals(result.toolMetadata.has("call-a"), true);
  assertEquals(result.toolMetadata.has("call-b"), true);
  assertEquals(result.toolMetadata.get("call-a")?.label, "a");
  assertEquals(result.toolMetadata.get("call-b")?.label, "b");
});

Deno.test("toolResultMetadata - attachMetadata creates immutable copy", async () => {
  const meta = { value: "original" };
  const myTool = tool({
    name: "snapshot",
    description: "Snapshot metadata",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async (ctx) => {
      ctx.attachMetadata("snap-1", meta);
      // Mutate original — should not affect stored copy
      meta.value = "mutated";
      return "ok";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("snapshot", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [myTool] });
  const result = await agent.run("snapshot");

  // The stored copy should have the original value, not the mutated one
  assertEquals(result.toolMetadata.get("snap-1")?.value, "original");
});

Deno.test("toolResultMetadata - RunResult has empty toolMetadata when no tools attach metadata", async () => {
  const myTool = tool({
    name: "silent",
    description: "No metadata",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async () => "ok",
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("silent", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [myTool] });
  const result = await agent.run("run silent");
  assertEquals(result.toolMetadata.size, 0);
});
