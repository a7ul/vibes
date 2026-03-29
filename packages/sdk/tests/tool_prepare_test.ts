import { assertEquals } from "@std/assert";
import { Agent, type RunContext, type ToolDefinition } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("tool.prepare - returning tool includes it", async () => {
  let prepareCallCount = 0;
  let toolNamesSeenByModel: string[] = [];

  const includedDef = z.object({});
  const myTool: ToolDefinition<undefined> = {
    name: "included",
    description: "Always included",
    parameters: includedDef,
    prepare: (ctx) => {
      prepareCallCount++;
      return ctx ? myTool : undefined; // always include
    },
    execute: () => Promise.resolve("executed"),
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("included", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      toolNamesSeenByModel = (opts.tools ?? []).map(
        (t: { name: string }) => t.name,
      );
      return Promise.resolve(responses());
    },
  });

  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("use the tool");

  assertEquals(prepareCallCount >= 1, true);
  assertEquals(toolNamesSeenByModel.includes("included"), true);
});

Deno.test("tool.prepare - returning null excludes tool from turn", async () => {
  type Deps = { isAdmin: boolean };
  let capturedToolNames: string[] = [];

  const adminDef = z.object({});
  const adminTool: ToolDefinition<Deps> = {
    name: "admin_action",
    description: "Admin only",
    parameters: adminDef,
    prepare: (ctx: RunContext<Deps>) => {
      return ctx.deps.isAdmin ? adminTool : null;
    },
    execute: () => Promise.resolve("admin executed"),
  };

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolNames = (opts.tools ?? []).map(
        (t: { name: string }) => t.name,
      );
      return Promise.resolve(textResponse("response"));
    },
  });

  const agent = new Agent<Deps>({ model, tools: [adminTool] });

  capturedToolNames = [];
  await agent.run("do something", { deps: { isAdmin: false } });
  assertEquals(capturedToolNames.includes("admin_action"), false);

  capturedToolNames = [];
  await agent.run("do something", { deps: { isAdmin: true } });
  assertEquals(capturedToolNames.includes("admin_action"), true);
});

Deno.test("tool.prepare - can modify tool description per turn", async () => {
  type Deps = { language: string };
  let capturedDescription: string | undefined;

  const greetTool: ToolDefinition<Deps> = {
    name: "greet",
    description: "original description",
    parameters: z.object({}),
    prepare: (ctx: RunContext<Deps>) => ({
      name: "greet",
      description: `Greet in ${ctx.deps.language}`,
      parameters: z.object({}),
      execute: () => Promise.resolve(`greet in ${ctx.deps.language}`),
    }),
    execute: () => Promise.resolve("greet"),
  };

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      const greetEntry = (opts.tools ?? []).find(
        (t: { name: string }) => t.name === "greet",
      );
      capturedDescription =
        (greetEntry as { name: string; description?: string })?.description;
      return Promise.resolve(textResponse("done"));
    },
  });

  const agent = new Agent<Deps>({ model, tools: [greetTool] });
  await agent.run("say hello", { deps: { language: "French" } });
  assertEquals(capturedDescription?.includes("French"), true);
});

Deno.test("tool.prepare - sync prepare function is supported", async () => {
  // pydantic-ai v1.72.0: sync tool preparation functions are supported.
  // In TypeScript, await works transparently with both sync and async returns.
  let prepareCallCount = 0;

  const syncPreparedTool: ToolDefinition<undefined> = {
    name: "sync_tool",
    description: "A tool with a sync prepare function",
    parameters: z.object({}),
    // Sync prepare - returns ToolDefinition directly (no Promise)
    prepare: (_ctx) => {
      prepareCallCount++;
      return syncPreparedTool; // sync return
    },
    execute: () => Promise.resolve("executed"),
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("sync_tool", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [syncPreparedTool] });
  await agent.run("use the tool");

  assertEquals(prepareCallCount >= 1, true);
});

Deno.test("tool.prepare - sync prepare returning null excludes tool", async () => {
  // Sync prepare returning null/undefined should exclude the tool, same as async.
  let toolNamesSeenByModel: string[] = [];

  const syncExcludedTool: ToolDefinition<undefined> = {
    name: "excluded_tool",
    description: "A tool excluded by sync prepare",
    parameters: z.object({}),
    prepare: (_ctx) => null, // sync null return
    execute: () => Promise.resolve("should not be called"),
  };

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      toolNamesSeenByModel = (opts.tools ?? []).map(
        (t: { name: string }) => t.name,
      );
      return Promise.resolve(textResponse("done"));
    },
  });

  const agent = new Agent({ model, tools: [syncExcludedTool] });
  await agent.run("do something");

  assertEquals(toolNamesSeenByModel.includes("excluded_tool"), false);
});
