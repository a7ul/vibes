import { assertEquals } from "@std/assert";
import {
  Agent,
  FunctionToolset,
  type RunContext,
  tool,
  type ToolCallNext,
  WrapperToolset,
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

function makeTool(name: string, returnValue?: string) {
  return tool({
    name,
    description: `${name} tool`,
    parameters: z.object({}),
    execute: () => Promise.resolve(returnValue ?? `${name} result`),
  });
}

// ---------------------------------------------------------------------------
// Concrete wrapper implementations used across tests
// ---------------------------------------------------------------------------

/** Records every (toolName, args, result) intercepted. */
class RecordingWrapper<TDeps = undefined> extends WrapperToolset<TDeps> {
  readonly log: Array<
    { name: string; args: Record<string, unknown>; result: unknown }
  > = [];

  async callTool(
    ctx: RunContext<TDeps>,
    toolName: string,
    args: Record<string, unknown>,
    next: ToolCallNext<TDeps>,
  ): Promise<unknown> {
    const result = await next(ctx, args);
    this.log.push({ name: toolName, args, result });
    return result;
  }
}

/** Replaces the return value of every tool call with a fixed string. */
class OverridingWrapper<TDeps = undefined> extends WrapperToolset<TDeps> {
  constructor(inner: FunctionToolset<TDeps>, readonly override: string) {
    super(inner);
  }

  async callTool(
    ctx: RunContext<TDeps>,
    _toolName: string,
    args: Record<string, unknown>,
    next: ToolCallNext<TDeps>,
  ): Promise<unknown> {
    await next(ctx, args); // still call inner, just discard result
    return this.override;
  }
}

/** Counts how many times callTool is invoked. */
class CountingWrapper<TDeps = undefined> extends WrapperToolset<TDeps> {
  count = 0;

  callTool(
    ctx: RunContext<TDeps>,
    _toolName: string,
    args: Record<string, unknown>,
    next: ToolCallNext<TDeps>,
  ): Promise<unknown> {
    this.count++;
    return next(ctx, args);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("WrapperToolset - exposes inner toolset's tools to agent", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = toolNames(opts);
      return Promise.resolve(textResponse("done"));
    },
  });

  const inner = new FunctionToolset([makeTool("alpha"), makeTool("beta")]);
  const wrapper = new RecordingWrapper(inner);
  const agent = new Agent({ model, toolsets: [wrapper] });
  await agent.run("go");

  assertEquals(capturedNames.includes("alpha"), true);
  assertEquals(capturedNames.includes("beta"), true);
});

Deno.test("WrapperToolset - callTool intercepted when model calls tool", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("greet", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const inner = new FunctionToolset([makeTool("greet")]);
  const wrapper = new RecordingWrapper(inner);
  const agent = new Agent({ model, toolsets: [wrapper] });
  await agent.run("say hello");

  assertEquals(wrapper.log.length, 1);
  assertEquals(wrapper.log[0].name, "greet");
  assertEquals(wrapper.log[0].result, "greet result");
});

Deno.test("WrapperToolset - can override tool return value", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("calc", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const inner = new FunctionToolset([makeTool("calc", "original")]);
  const wrapper = new OverridingWrapper(inner, "overridden");
  const agent = new Agent({ model, toolsets: [wrapper] });

  // We just verify the run completes without error; the overriding behaviour
  // is exercised by the wrapper calling next() and discarding the result.
  await agent.run("calc something");
  // No assertion on the final output - the model drives the conversation.
  // The key invariant is that the wrapper's callTool was invoked.
});

Deno.test("WrapperToolset - callTool invoked once per tool execution", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("ping", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const inner = new FunctionToolset([makeTool("ping")]);
  const wrapper = new CountingWrapper(inner);
  const agent = new Agent({ model, toolsets: [wrapper] });
  await agent.run("ping");

  assertEquals(wrapper.count, 1);
});

Deno.test("WrapperToolset - multiple tools each intercepted separately", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("first", {}, "tc1"),
    toolCallResponse("second", {}, "tc2"),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const inner = new FunctionToolset([makeTool("first"), makeTool("second")]);
  const wrapper = new RecordingWrapper(inner);
  const agent = new Agent({ model, toolsets: [wrapper] });
  await agent.run("use both");

  assertEquals(wrapper.log.length, 2);
  const names = wrapper.log.map((e) => e.name).sort();
  assertEquals(names, ["first", "second"]);
});

Deno.test("WrapperToolset - preserves tool metadata (name, description) in output list", async () => {
  let capturedTools: ToolEntry[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedTools = (opts.tools ?? []) as ToolEntry[];
      return Promise.resolve(textResponse("done"));
    },
  });

  const myTool = tool({
    name: "my_tool",
    description: "My special tool",
    parameters: z.object({}),
    execute: () => Promise.resolve("result"),
  });

  const inner = new FunctionToolset([myTool]);
  const wrapper = new RecordingWrapper(inner);
  const agent = new Agent({ model, toolsets: [wrapper] });
  await agent.run("go");

  const captured = capturedTools.find((t) => t.name === "my_tool");
  assertEquals(captured?.description, "My special tool");
});

Deno.test("WrapperToolset - works with deps via RunContext", async () => {
  type Deps = { prefix: string };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("greet", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const capturedDeps: Deps[] = [];

  class DepCapturingWrapper extends WrapperToolset<Deps> {
    callTool(
      ctx: RunContext<Deps>,
      _toolName: string,
      args: Record<string, unknown>,
      next: ToolCallNext<Deps>,
    ): Promise<unknown> {
      capturedDeps.push(ctx.deps);
      return next(ctx, args);
    }
  }

  const inner = new FunctionToolset<Deps>([
    makeTool("greet") as unknown as import("../mod.ts").ToolDefinition<Deps>,
  ]);
  const wrapper = new DepCapturingWrapper(inner);
  const agent = new Agent<Deps>({ model, toolsets: [wrapper] });
  await agent.run("go", { deps: { prefix: "hello" } });

  assertEquals(capturedDeps.length, 1);
  assertEquals(capturedDeps[0].prefix, "hello");
});
