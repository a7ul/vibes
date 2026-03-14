import { assertEquals } from "@std/assert";
import {
  Agent,
  CombinedToolset,
  FilteredToolset,
  FunctionToolset,
  PrefixedToolset,
  RenamedToolset,
  tool,
} from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";
import { z } from "zod";

type ToolEntry = { name: string; description?: string };

function toolNames(opts: { tools?: ToolEntry[] }): string[] {
  return (opts.tools ?? []).map((t) => t.name);
}

function makeTool(name: string) {
  return tool({
    name,
    description: `${name} tool`,
    parameters: z.object({}),
    execute: () => Promise.resolve(`${name} result`),
  });
}

Deno.test("FunctionToolset - exposes tools to agent", async () => {
  let capturedNames: string[] = [];
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("alpha", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(responses());
    },
  });

  const ts = new FunctionToolset([makeTool("alpha"), makeTool("beta")]);
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("use tools");

  assertEquals(capturedNames.includes("alpha"), true);
  assertEquals(capturedNames.includes("beta"), true);
});

Deno.test("CombinedToolset - merges multiple toolsets", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(textResponse("done"));
    },
  });

  const ts1 = new FunctionToolset([makeTool("search")]);
  const ts2 = new FunctionToolset([makeTool("fetch")]);
  const combined = new CombinedToolset(ts1, ts2);
  const agent = new Agent({ model, toolsets: [combined] });
  await agent.run("go");

  assertEquals(capturedNames.includes("search"), true);
  assertEquals(capturedNames.includes("fetch"), true);
});

Deno.test("CombinedToolset - last toolset wins on name conflict", async () => {
  let capturedDesc: string | undefined;
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      const entry = (opts.tools ?? []).find((t: ToolEntry) =>
        t.name === "my_tool"
      );
      capturedDesc = (entry as { name: string; description?: string })
        ?.description;
      return Promise.resolve(textResponse("done"));
    },
  });

  const ts1 = new FunctionToolset([
    tool({
      name: "my_tool",
      description: "first",
      parameters: z.object({}),
      execute: () => Promise.resolve("1"),
    }),
  ]);
  const ts2 = new FunctionToolset([
    tool({
      name: "my_tool",
      description: "second",
      parameters: z.object({}),
      execute: () => Promise.resolve("2"),
    }),
  ]);

  const combined = new CombinedToolset(ts1, ts2);
  const agent = new Agent({ model, toolsets: [combined] });
  await agent.run("go");

  assertEquals(capturedDesc, "second");
});

Deno.test("FilteredToolset - excludes tools when predicate returns false", async () => {
  type Deps = { admin: boolean };
  let capturedNames: string[] = [];

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(textResponse("done"));
    },
  });

  const adminTs = new FunctionToolset<Deps>([
    makeTool("delete_user") as unknown as import("../mod.ts").ToolDefinition<
      Deps
    >,
  ]);
  const filtered = new FilteredToolset<Deps>(adminTs, (ctx) => ctx.deps.admin);
  const agent = new Agent<Deps>({ model, toolsets: [filtered] });

  capturedNames = [];
  await agent.run("try", { deps: { admin: false } });
  assertEquals(capturedNames.includes("delete_user"), false);

  capturedNames = [];
  await agent.run("try", { deps: { admin: true } });
  assertEquals(capturedNames.includes("delete_user"), true);
});

Deno.test("PrefixedToolset - prepends prefix to tool names", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(textResponse("done"));
    },
  });

  const ts = new FunctionToolset([makeTool("search"), makeTool("fetch")]);
  const prefixed = new PrefixedToolset(ts, "web_");
  const agent = new Agent({ model, toolsets: [prefixed] });
  await agent.run("go");

  assertEquals(capturedNames.includes("web_search"), true);
  assertEquals(capturedNames.includes("web_fetch"), true);
  assertEquals(capturedNames.includes("search"), false);
});

Deno.test("RenamedToolset - renames specific tools", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(textResponse("done"));
    },
  });

  const ts = new FunctionToolset([makeTool("search"), makeTool("fetch")]);
  const renamed = new RenamedToolset(ts, { search: "find" });
  const agent = new Agent({ model, toolsets: [renamed] });
  await agent.run("go");

  assertEquals(capturedNames.includes("find"), true);
  assertEquals(capturedNames.includes("fetch"), true);
  assertEquals(capturedNames.includes("search"), false);
});

Deno.test("Agent.addToolset - adds toolset after construction", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(textResponse("done"));
    },
  });

  const agent = new Agent({ model });
  agent.addToolset(new FunctionToolset([makeTool("late_tool")]));
  await agent.run("go");

  assertEquals(capturedNames.includes("late_tool"), true);
});

Deno.test("tools and toolsets combined - both appear in model call", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(textResponse("done"));
    },
  });

  const directTool = makeTool("direct");
  const ts = new FunctionToolset([makeTool("from_toolset")]);
  const agent = new Agent({ model, tools: [directTool], toolsets: [ts] });
  await agent.run("go");

  assertEquals(capturedNames.includes("direct"), true);
  assertEquals(capturedNames.includes("from_toolset"), true);
});
