import { assertEquals } from "@std/assert";
import {
  Agent,
  DeferredLoadingToolset,
  FunctionToolset,
  tool,
  ToolSearchToolset,
} from "../mod.ts";
import type { ToolSearchFn, ToolSearchToolsetOptions } from "../mod.ts";
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
    parameters: z.object({}),
    execute: () => Promise.resolve(`${name} result`),
  });
}

type ToolEntry = { name: string };
function toolNames(opts: { tools?: ToolEntry[] }): string[] {
  return (opts.tools ?? []).map((t) => t.name);
}

// ---------------------------------------------------------------------------
// DeferredLoadingToolset tests
// ---------------------------------------------------------------------------

Deno.test("DeferredLoadingToolset - marks all tools with deferLoading flag", async () => {
  const capturedToolLists: string[][] = [];
  const responses = mockValues<DoGenerateResult>(
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolLists.push(toolNames(opts));
      return Promise.resolve(responses());
    },
  });

  // Without ToolSearchToolset, DeferredLoadingToolset still passes tools through.
  const inner = new FunctionToolset([makeTool("alpha"), makeTool("beta")]);
  const ts = new DeferredLoadingToolset(inner);
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("test");

  assertEquals(capturedToolLists[0].includes("alpha"), true);
  assertEquals(capturedToolLists[0].includes("beta"), true);
});

Deno.test("DeferredLoadingToolset - partial: only specified tools get deferLoading", async () => {
  const capturedToolLists: string[][] = [];
  const responses = mockValues<DoGenerateResult>(
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolLists.push(toolNames(opts));
      return Promise.resolve(responses());
    },
  });

  const inner = new FunctionToolset([
    makeTool("alpha"),
    makeTool("beta"),
    makeTool("gamma"),
  ]);
  // Only beta is deferred; alpha and gamma are visible always.
  const ts = new DeferredLoadingToolset(inner, new Set(["beta"]));
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("test");

  assertEquals(capturedToolLists[0].includes("alpha"), true);
  assertEquals(capturedToolLists[0].includes("gamma"), true);
});

// ---------------------------------------------------------------------------
// ToolSearchToolset tests
// ---------------------------------------------------------------------------

Deno.test("ToolSearchToolset - hides deferred tools, shows search_tools", async () => {
  const capturedToolLists: string[][] = [];
  const responses = mockValues<DoGenerateResult>(
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolLists.push(toolNames(opts));
      return Promise.resolve(responses());
    },
  });

  const inner = new FunctionToolset([makeTool("alpha"), makeTool("beta")]);
  const ts = new ToolSearchToolset(new DeferredLoadingToolset(inner));
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("test");

  assertEquals(capturedToolLists[0].includes("search_tools"), true);
  assertEquals(capturedToolLists[0].includes("alpha"), false);
  assertEquals(capturedToolLists[0].includes("beta"), false);
});

Deno.test("ToolSearchToolset - discovered tools appear in subsequent turns", async () => {
  const capturedToolLists: string[][] = [];
  const responses = mockValues<DoGenerateResult>(
    // Turn 1: call search_tools with queries array
    toolCallResponse("search_tools", { queries: ["alpha"] }, "tc1"),
    // Turn 2: use the discovered tool
    toolCallResponse("alpha", {}, "tc2"),
    // Turn 3: done
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolLists.push(toolNames(opts));
      return Promise.resolve(responses());
    },
  });

  const inner = new FunctionToolset([
    makeTool("alpha", "alpha capability"),
    makeTool("beta", "beta capability"),
  ]);
  const ts = new ToolSearchToolset(new DeferredLoadingToolset(inner));
  const agent = new Agent({ model, toolsets: [ts], maxTurns: 10 });
  const result = await agent.run("use alpha tool");

  // Turn 1: only search_tools visible (deferred tools hidden)
  assertEquals(capturedToolLists[0].includes("search_tools"), true);
  assertEquals(capturedToolLists[0].includes("alpha"), false);
  assertEquals(capturedToolLists[0].includes("beta"), false);

  // Turn 2: alpha discovered and visible; beta still hidden; search_tools still present
  assertEquals(capturedToolLists[1].includes("alpha"), true);
  assertEquals(capturedToolLists[1].includes("beta"), false);
  assertEquals(capturedToolLists[1].includes("search_tools"), true);

  assertEquals(result.output, "done");
});

Deno.test("ToolSearchToolset - non-deferred tools are always visible", async () => {
  const capturedToolLists: string[][] = [];
  const responses = mockValues<DoGenerateResult>(
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolLists.push(toolNames(opts));
      return Promise.resolve(responses());
    },
  });

  const alwaysVisible = new FunctionToolset([makeTool("always_visible")]);
  const searchable = new ToolSearchToolset(
    new DeferredLoadingToolset(new FunctionToolset([makeTool("hidden_tool")])),
  );
  const agent = new Agent({ model, toolsets: [alwaysVisible, searchable] });
  await agent.run("test");

  assertEquals(capturedToolLists[0].includes("always_visible"), true);
  assertEquals(capturedToolLists[0].includes("hidden_tool"), false);
  assertEquals(capturedToolLists[0].includes("search_tools"), true);
});

Deno.test("ToolSearchToolset - per-run isolation: discoveries reset between runs", async () => {
  const capturedTurn1PerRun: string[][] = [];
  let callCount = 0;

  // Run 1: turn1 searches, turn2 sees alpha, turn3 done
  // Run 2: turn1 should NOT see alpha (fresh run)
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("search_tools", { queries: ["alpha"] }, "tc1"), // run1, turn1
    textResponse("done run1"), // run1, turn2
    textResponse("done run2"), // run2, turn1
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedTurn1PerRun.push(toolNames(opts));
      callCount++;
      return Promise.resolve(responses());
    },
  });

  const inner = new FunctionToolset([makeTool("alpha"), makeTool("beta")]);
  const ts = new ToolSearchToolset(new DeferredLoadingToolset(inner));
  const agent = new Agent({ model, toolsets: [ts], maxTurns: 5 });

  await agent.run("run 1");
  await agent.run("run 2");

  // Verify run 2's first turn doesn't see alpha (state reset)
  // The last captured turn is run2's turn1
  const run2Turn1 = capturedTurn1PerRun[capturedTurn1PerRun.length - 1];
  assertEquals(run2Turn1.includes("alpha"), false);
  assertEquals(run2Turn1.includes("search_tools"), true);
});

Deno.test("ToolSearchToolset - no-op when no tools have deferLoading", async () => {
  const capturedToolLists: string[][] = [];
  const responses = mockValues<DoGenerateResult>(
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolLists.push(toolNames(opts));
      return Promise.resolve(responses());
    },
  });

  // ToolSearchToolset without DeferredLoadingToolset — tools have no deferLoading
  const inner = new FunctionToolset([makeTool("alpha"), makeTool("beta")]);
  const ts = new ToolSearchToolset(inner);
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("test");

  // All tools visible, no search_tools injected
  assertEquals(capturedToolLists[0].includes("alpha"), true);
  assertEquals(capturedToolLists[0].includes("beta"), true);
  assertEquals(capturedToolLists[0].includes("search_tools"), false);
});

// ---------------------------------------------------------------------------
// Token-based search algorithm tests
// ---------------------------------------------------------------------------

async function getSearchExecute(
  toolDefs: ReturnType<typeof makeTool>[],
  options?: ToolSearchToolsetOptions,
) {
  const inner = new FunctionToolset(toolDefs);
  const ts = new ToolSearchToolset(new DeferredLoadingToolset(inner), options);
  const allTools = await ts.tools({} as never);
  const searchToolDef = allTools.find((t) => t.name === "search_tools");
  if (!searchToolDef) throw new Error("search_tools not found");
  return (queries: string[]) =>
    searchToolDef.execute({} as never, { queries });
}

Deno.test("ToolSearchToolset - token matching: exact word 'me' does not match 'comment'", async () => {
  const exec = await getSearchExecute([
    makeTool("get_me", "returns the current user"),
    makeTool("comment_tool", "post a comment"),
  ]);

  const result = JSON.parse((await exec(["me"])) as string) as Array<
    { name: string }
  >;
  const names = result.map((r) => r.name);
  // "me" as a token matches "get_me" (token: "me") but NOT "comment_tool"
  // (tokens: "comment", "tool" - no "me" token)
  assertEquals(names.includes("get_me"), true);
  assertEquals(names.includes("comment_tool"), false);
});

Deno.test("ToolSearchToolset - token scoring: results ordered by number of matching tokens", async () => {
  // "get user profile" => query tokens: {get, user, profile}
  // "get_user_profile" tokens: {get, user, profile} => score 3
  // "get_user" tokens: {get, user} => score 2
  // "user_data" tokens: {user, data} => score 1
  const exec = await getSearchExecute([
    makeTool("user_data", "retrieve raw user data"),
    makeTool("get_user", "get a user by id"),
    makeTool("get_user_profile", "get user profile details"),
  ]);

  const result = JSON.parse(
    (await exec(["get user profile"])) as string,
  ) as Array<{ name: string }>;
  assertEquals(result[0].name, "get_user_profile");
  assertEquals(result[1].name, "get_user");
  assertEquals(result[2].name, "user_data");
});

Deno.test("ToolSearchToolset - token matching: no match returns not-found message", async () => {
  const exec = await getSearchExecute([
    makeTool("fetch_weather", "get current weather"),
  ]);

  const result = await exec(["payment invoice billing"]);
  assertEquals(
    result,
    "No matching tools found. The tools you need may not be available.",
  );
});

Deno.test("ToolSearchToolset - multiple queries are unioned", async () => {
  // Query 1: "alpha" matches alpha_tool
  // Query 2: "beta" matches beta_tool
  // Both should appear in results
  const exec = await getSearchExecute([
    makeTool("alpha_tool", "alpha capability"),
    makeTool("beta_tool", "beta capability"),
    makeTool("gamma_tool", "gamma capability"),
  ]);

  const result = JSON.parse(
    (await exec(["alpha", "beta"])) as string,
  ) as Array<{ name: string }>;
  const names = result.map((r) => r.name);
  assertEquals(names.includes("alpha_tool"), true);
  assertEquals(names.includes("beta_tool"), true);
  assertEquals(names.includes("gamma_tool"), false);
});

Deno.test("ToolSearchToolset - empty queries array returns prompt message", async () => {
  const exec = await getSearchExecute([makeTool("some_tool", "some tool")]);
  const result = await exec([]);
  assertEquals(result, "Please provide search queries.");
});

Deno.test("ToolSearchToolset - maxResults limits the number of results", async () => {
  const manyTools = Array.from({ length: 15 }, (_, i) =>
    makeTool(`tool_${i}`, `tool ${i} matching description`)
  );
  const exec = await getSearchExecute(manyTools, { maxResults: 3 });

  const result = JSON.parse(
    (await exec(["tool matching description"])) as string,
  ) as Array<{ name: string }>;
  assertEquals(result.length <= 3, true);
});

Deno.test("ToolSearchToolset - custom searchFn is called with queries and tool defs", async () => {
  const capturedArgs: { queries: string[]; toolNames: string[] }[] = [];

  const searchFn: ToolSearchFn = (
    _ctx,
    queries,
    tools,
  ) => {
    capturedArgs.push({ queries, toolNames: tools.map((t) => t.name) });
    // Return the first matching tool name by simple substring
    return tools
      .filter((t) => queries.some((q) => t.name.includes(q)))
      .map((t) => t.name);
  };

  const exec = await getSearchExecute(
    [
      makeTool("alpha_tool", "alpha capability"),
      makeTool("beta_tool", "beta capability"),
    ],
    { searchFn },
  );

  const result = JSON.parse(
    (await exec(["alpha"])) as string,
  ) as Array<{ name: string }>;
  const names = result.map((r) => r.name);

  // Custom fn was called
  assertEquals(capturedArgs.length, 1);
  assertEquals(capturedArgs[0].queries, ["alpha"]);
  assertEquals(capturedArgs[0].toolNames.includes("alpha_tool"), true);
  assertEquals(capturedArgs[0].toolNames.includes("beta_tool"), true);

  // Only alpha_tool matched
  assertEquals(names.includes("alpha_tool"), true);
  assertEquals(names.includes("beta_tool"), false);
});

Deno.test("ToolSearchToolset - async custom searchFn works correctly", async () => {
  const searchFn: ToolSearchFn = async (
    _ctx,
    queries,
    tools,
  ) => {
    await Promise.resolve(); // simulate async work
    return tools
      .filter((t) => queries.some((q) => t.name.includes(q)))
      .map((t) => t.name);
  };

  const exec = await getSearchExecute(
    [
      makeTool("async_tool", "async capability"),
      makeTool("sync_tool", "sync capability"),
    ],
    { searchFn },
  );

  const result = JSON.parse(
    (await exec(["async"])) as string,
  ) as Array<{ name: string }>;
  assertEquals(result[0].name, "async_tool");
});

Deno.test("ToolSearchToolset - custom searchFn returns empty array gives not-found message", async () => {
  const searchFn: ToolSearchFn = () => [];
  const exec = await getSearchExecute(
    [makeTool("some_tool", "some tool")],
    { searchFn },
  );
  const result = await exec(["anything"]);
  assertEquals(
    result,
    "No matching tools found. The tools you need may not be available.",
  );
});

