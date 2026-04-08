import { assertEquals } from "@std/assert";
import { FunctionToolset, SetMetadataToolset, tool } from "../mod.ts";
import { matchesToolSelector } from "../mod.ts";
import type { ToolSelector } from "../mod.ts";
import type { RunContext } from "../mod.ts";
import { z } from "zod";

// Helper to build a minimal RunContext for tests
function makeCtx(): RunContext<undefined> {
  return {
    deps: undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };
}

const searchTool = tool({
  name: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: (_ctx, _args) => Promise.resolve("results"),
  metadata: { category: "retrieval" },
});

const fetchTool = tool({
  name: "fetch",
  description: "Fetch a URL",
  parameters: z.object({ url: z.string() }),
  execute: () => Promise.resolve("content"),
});

// ---------------------------------------------------------------------------
// ToolDefinition.metadata
// ---------------------------------------------------------------------------

Deno.test("tool metadata - metadata is stored on ToolDefinition", () => {
  const t = tool({
    name: "tagged",
    description: "A tagged tool",
    parameters: z.object({}),
    execute: () => Promise.resolve("ok"),
    metadata: { tier: "premium", version: 2 },
  });
  assertEquals(t.metadata?.tier, "premium");
  assertEquals(t.metadata?.version, 2);
});

Deno.test("tool metadata - metadata defaults to undefined when not set", () => {
  const t = tool({
    name: "plain",
    description: "No metadata",
    parameters: z.object({}),
    execute: () => Promise.resolve("ok"),
  });
  assertEquals(t.metadata, undefined);
});

// ---------------------------------------------------------------------------
// matchesToolSelector
// ---------------------------------------------------------------------------

Deno.test("matchesToolSelector - 'all' matches any tool", async () => {
  const ctx = makeCtx();
  assertEquals(await matchesToolSelector("all", ctx, searchTool), true);
  assertEquals(await matchesToolSelector("all", ctx, fetchTool), true);
});

Deno.test("matchesToolSelector - string array matches by name", async () => {
  const ctx = makeCtx();
  const selector: ToolSelector = ["search", "compute"];
  assertEquals(await matchesToolSelector(selector, ctx, searchTool), true);
  assertEquals(await matchesToolSelector(selector, ctx, fetchTool), false);
});

Deno.test("matchesToolSelector - object selector matches by metadata inclusion", async () => {
  const ctx = makeCtx();
  const selector: ToolSelector = { category: "retrieval" };
  assertEquals(await matchesToolSelector(selector, ctx, searchTool), true);
  assertEquals(await matchesToolSelector(selector, ctx, fetchTool), false);
});

Deno.test("matchesToolSelector - object selector with missing metadata returns false", async () => {
  const ctx = makeCtx();
  const selector: ToolSelector = { category: "analytics" };
  // searchTool has category: "retrieval" which doesn't match
  assertEquals(await matchesToolSelector(selector, ctx, searchTool), false);
});

Deno.test("matchesToolSelector - function selector is called with ctx and tool", async () => {
  const ctx = makeCtx();
  let called = false;
  const selector: ToolSelector = (_c, t) => {
    called = true;
    return t.name === "search";
  };
  assertEquals(await matchesToolSelector(selector, ctx, searchTool), true);
  assertEquals(called, true);
  assertEquals(await matchesToolSelector(selector, ctx, fetchTool), false);
});

Deno.test("matchesToolSelector - async function selector works", async () => {
  const ctx = makeCtx();
  const selector: ToolSelector = async (_c, t) => {
    await Promise.resolve();
    return t.name === "fetch";
  };
  assertEquals(await matchesToolSelector(selector, ctx, fetchTool), true);
  assertEquals(await matchesToolSelector(selector, ctx, searchTool), false);
});

// ---------------------------------------------------------------------------
// SetMetadataToolset
// ---------------------------------------------------------------------------

Deno.test("SetMetadataToolset - merges metadata onto all tools by default", async () => {
  const inner = new FunctionToolset([searchTool, fetchTool]);
  const tagged = new SetMetadataToolset(inner, { env: "prod" });
  const ctx = makeCtx();
  const tools = await tagged.tools(ctx);

  for (const t of tools) {
    assertEquals(t.metadata?.env, "prod");
  }
});

Deno.test("SetMetadataToolset - preserves existing metadata", async () => {
  const inner = new FunctionToolset([searchTool, fetchTool]);
  const tagged = new SetMetadataToolset(inner, { env: "prod" });
  const ctx = makeCtx();
  const tools = await tagged.tools(ctx);

  const search = tools.find((t) => t.name === "search");
  // Original metadata retained; new metadata added
  assertEquals(search?.metadata?.category, "retrieval");
  assertEquals(search?.metadata?.env, "prod");
});

Deno.test("SetMetadataToolset - new metadata takes precedence over existing", async () => {
  const inner = new FunctionToolset([searchTool]);
  const tagged = new SetMetadataToolset(inner, { category: "updated" });
  const ctx = makeCtx();
  const [t] = await tagged.tools(ctx);
  assertEquals(t.metadata?.category, "updated");
});

Deno.test("SetMetadataToolset - selector restricts which tools are tagged", async () => {
  const inner = new FunctionToolset([searchTool, fetchTool]);
  const tagged = new SetMetadataToolset(inner, { env: "prod" }, ["search"]);
  const ctx = makeCtx();
  const tools = await tagged.tools(ctx);

  const search = tools.find((t) => t.name === "search");
  const fetch = tools.find((t) => t.name === "fetch");
  assertEquals(search?.metadata?.env, "prod");
  assertEquals(fetch?.metadata?.env, undefined);
});

Deno.test("SetMetadataToolset - metadata selector matches tools with matching metadata", async () => {
  const inner = new FunctionToolset([searchTool, fetchTool]);
  // Only tag tools whose metadata has category: "retrieval"
  const tagged = new SetMetadataToolset(inner, { env: "staging" }, { category: "retrieval" });
  const ctx = makeCtx();
  const tools = await tagged.tools(ctx);

  const search = tools.find((t) => t.name === "search");
  const fetch = tools.find((t) => t.name === "fetch");
  assertEquals(search?.metadata?.env, "staging");
  assertEquals(fetch?.metadata?.env, undefined);
});

Deno.test("SetMetadataToolset - does not mutate original tool definitions", async () => {
  const inner = new FunctionToolset([searchTool]);
  const tagged = new SetMetadataToolset(inner, { env: "test" });
  const ctx = makeCtx();
  await tagged.tools(ctx);

  // Original tool definition must be unchanged
  assertEquals(searchTool.metadata?.env, undefined);
  assertEquals(searchTool.metadata?.category, "retrieval");
});
