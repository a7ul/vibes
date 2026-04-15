import { assertEquals } from "@std/assert";
import {
  Agent,
  CombinedToolset,
  FilteredToolset,
  FunctionToolset,
  PrefixedToolset,
  RenamedToolset,
  tool,
  type Toolset,
} from "../mod.ts";
import type { RunContext } from "../mod.ts";
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

Deno.test("CombinedToolset - propagates forRun to child toolsets", async () => {
  const forRunCalled: string[] = [];

  function makeLifecycleToolset(id: string): Toolset {
    let runInstance: Toolset | null = null;
    const ts: Toolset = {
      tools: () => Promise.resolve([makeTool(`tool_${id}`)]),
      forRun(_ctx) {
        forRunCalled.push(id);
        runInstance = {
          tools: () => Promise.resolve([makeTool(`tool_${id}`)]),
        };
        return Promise.resolve(runInstance);
      },
    };
    return ts;
  }

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("done")),
  });

  const ts1 = makeLifecycleToolset("a");
  const ts2 = makeLifecycleToolset("b");
  const combined = new CombinedToolset(ts1, ts2);
  const agent = new Agent({ model, toolsets: [combined] });
  await agent.run("go");

  assertEquals(forRunCalled.includes("a"), true, "forRun should be called on child ts 'a'");
  assertEquals(forRunCalled.includes("b"), true, "forRun should be called on child ts 'b'");
});

Deno.test("CombinedToolset - propagates forRunStep to child toolsets", async () => {
  const forRunStepCalled: string[] = [];

  function makeStepToolset(id: string): Toolset {
    const ts: Toolset = {
      tools: () => Promise.resolve([makeTool(`tool_${id}`)]),
      forRunStep(_ctx) {
        forRunStepCalled.push(id);
        return Promise.resolve(this);
      },
    };
    return ts;
  }

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("tool_a", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const ts1 = makeStepToolset("a");
  const ts2 = makeStepToolset("b");
  const combined = new CombinedToolset(ts1, ts2);
  const agent = new Agent({ model, toolsets: [combined] });
  await agent.run("go");

  assertEquals(
    forRunStepCalled.filter((id) => id === "a").length >= 1,
    true,
    "forRunStep should be called on child ts 'a' at least once",
  );
  assertEquals(
    forRunStepCalled.filter((id) => id === "b").length >= 1,
    true,
    "forRunStep should be called on child ts 'b' at least once",
  );
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

// ---------------------------------------------------------------------------
// forRun / forRunStep lifecycle hooks
// ---------------------------------------------------------------------------

Deno.test("forRun - called once before turn loop, returned instance used for all turns", async () => {
  let forRunCallCount = 0;
  let forRunCtx: RunContext<undefined> | null = null;

  const innerTs = new FunctionToolset([makeTool("my_tool")]);

  const ts: Toolset = {
    tools: (ctx) => innerTs.tools(ctx),
    forRun(ctx) {
      forRunCallCount++;
      forRunCtx = ctx;
      return innerTs; // return the inner toolset as the run-scoped instance
    },
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("my_tool", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("go");

  assertEquals(forRunCallCount, 1, "forRun should be called exactly once per run");
  assertEquals(forRunCtx !== null, true, "forRun should receive the run context");
});

Deno.test("forRun - run isolation: separate instances per run", async () => {
  const instancesUsed: string[] = [];

  function makeInstance(id: string): Toolset {
    return {
      tools: () =>
        Promise.resolve([
          tool({
            name: "my_tool",
            description: `tool from ${id}`,
            parameters: z.object({}),
            execute: () => Promise.resolve(`result from ${id}`),
          }),
        ]),
    };
  }

  let runCount = 0;
  const ts: Toolset = {
    tools: () => Promise.resolve([]),
    forRun() {
      const id = `run-${++runCount}`;
      instancesUsed.push(id);
      return makeInstance(id);
    },
  };

  const responses = mockValues<DoGenerateResult>(
    textResponse("done"),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("first run");
  await agent.run("second run");

  assertEquals(instancesUsed.length, 2, "forRun should be called once per agent.run()");
  assertEquals(instancesUsed[0], "run-1");
  assertEquals(instancesUsed[1], "run-2");
});

Deno.test("forRunStep - called at the start of every model turn", async () => {
  let stepCallCount = 0;

  const innerTs = new FunctionToolset([makeTool("step_tool")]);

  const ts: Toolset = {
    tools: (ctx) => innerTs.tools(ctx),
    forRunStep() {
      stepCallCount++;
      return innerTs;
    },
  };

  // Two turns: turn 1 calls a tool, turn 2 returns text
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("step_tool", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("go");

  assertEquals(stepCallCount, 2, "forRunStep should be called once per model turn");
});

Deno.test("forRunStep - can return different instance each step", async () => {
  const stepsObserved: number[] = [];
  let step = 0;

  function makeStepInstance(s: number): Toolset {
    return {
      tools: () =>
        Promise.resolve([
          tool({
            name: "step_tool",
            description: `tool for step ${s}`,
            parameters: z.object({}),
            execute: () => {
              stepsObserved.push(s);
              return Promise.resolve(`step ${s} result`);
            },
          }),
        ]),
    };
  }

  const ts: Toolset = {
    tools: () => Promise.resolve([]),
    forRunStep() {
      return makeStepInstance(++step);
    },
  };

  // Two turns: turn 1 calls the tool, turn 2 returns text
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("step_tool", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("go");

  // The tool was called in turn 1, which used the instance from forRunStep(1)
  assertEquals(stepsObserved, [1]);
});

Deno.test("forRun and forRunStep - both hooks can be combined", async () => {
  const log: string[] = [];

  const innerTs = new FunctionToolset([makeTool("combined_tool")]);

  const ts: Toolset = {
    tools: (ctx) => innerTs.tools(ctx),
    forRun() {
      log.push("forRun");
      return {
        tools: (ctx) => innerTs.tools(ctx),
        forRunStep() {
          log.push("forRunStep");
          return innerTs;
        },
      };
    },
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("combined_tool", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("go");

  assertEquals(log[0], "forRun", "forRun should be called first");
  assertEquals(log.filter((x) => x === "forRunStep").length, 2, "forRunStep called once per turn");
});
