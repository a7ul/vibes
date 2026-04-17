import { assertEquals } from "@std/assert";
import {
  Agent,
  DeferredLoadingToolset,
  FunctionToolset,
  tool,
  ToolSearchToolset,
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
    parameters: z.object({}),
    execute: () => Promise.resolve(`${name} result`),
  });
}

type ToolEntry = { name: string };
function toolNames(opts: { tools?: ToolEntry[] }): string[] {
  return (opts.tools ?? []).map((t) => t.name);
}

/** Extract the search_tools result value from the second-turn prompt. */
function extractSearchResult(opts: { prompt?: unknown[] }): string {
  for (const msg of opts.prompt ?? []) {
    const m = msg as { role?: string; content?: unknown[] };
    if (m.role === "tool") {
      for (const part of m.content ?? []) {
        const p = part as { type?: string; toolName?: string; output?: unknown };
        if (p.type === "tool-result" && p.toolName === "search_tools") {
          const output = p.output as { type?: string; value?: string } | undefined;
          if (output?.type === "text" && typeof output.value === "string") {
            return output.value;
          }
        }
      }
    }
  }
  return "";
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
    // Turn 1: call search_tools
    toolCallResponse("search_tools", { keywords: "alpha" }, "tc1"),
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
    toolCallResponse("search_tools", { keywords: "alpha" }, "tc1"), // run1, turn1
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
// Token-based keyword matching tests (pydantic-ai v1.84.0 bug fix)
// ---------------------------------------------------------------------------

Deno.test("ToolSearchToolset - token matching: finds tool by exact token, not substring", async () => {
  // Bug fix (pydantic-ai v1.84.0): searching "me" should NOT match "comment_tool"
  // (which contains "me" as a substring of "comment"), but SHOULD match "get_me"
  // (which contains "me" as an exact alphanumeric token).
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("search_tools", { keywords: "me" }, "tc1"),
    textResponse("done"),
  );

  let capturedSearchResult = "";
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSearchResult = extractSearchResult(opts) || capturedSearchResult;
      return Promise.resolve(responses());
    },
  });

  const commentTool = tool({
    name: "comment_tool",
    description: "Post a comment",
    parameters: z.object({}),
    execute: () => Promise.resolve("commented"),
  });
  const getMeTool = tool({
    name: "get_me",
    description: "Get the current user profile",
    parameters: z.object({}),
    execute: () => Promise.resolve("profile"),
  });

  const ts = new ToolSearchToolset(
    new DeferredLoadingToolset(new FunctionToolset([commentTool, getMeTool])),
  );

  const agent = new Agent({ model, toolsets: [ts], maxTurns: 5 });
  await agent.run("find me tool");

  // "me" should match "get_me" (exact token) but NOT "comment_tool"
  // (where "me" only appears as substring inside "comment").
  assertEquals(capturedSearchResult.includes("get_me"), true);
  assertEquals(capturedSearchResult.includes("comment_tool"), false);
});

Deno.test("ToolSearchToolset - token matching: higher-scoring tool appears first", async () => {
  // "github profile" has two tokens: "github" and "profile".
  // "github_get_profile" matches both (score 2).
  // "profile_viewer" matches one: "profile" (score 1).
  // "github_issues" matches one: "github" (score 1).
  // Result order: github_get_profile must appear before the single-match tools.
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("search_tools", { keywords: "github profile" }, "tc1"),
    textResponse("done"),
  );

  let capturedSearchResult = "";
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSearchResult = extractSearchResult(opts) || capturedSearchResult;
      return Promise.resolve(responses());
    },
  });

  const ts = new ToolSearchToolset(
    new DeferredLoadingToolset(
      new FunctionToolset([
        makeTool("github_get_profile", "Get a GitHub user profile"),
        makeTool("profile_viewer", "View any user profile"),
        makeTool("github_issues", "List GitHub issues"),
      ]),
    ),
  );

  const agent = new Agent({ model, toolsets: [ts], maxTurns: 5 });
  await agent.run("search");

  const parsed: Array<{ name: string }> = JSON.parse(capturedSearchResult);
  assertEquals(parsed[0].name, "github_get_profile");
});
