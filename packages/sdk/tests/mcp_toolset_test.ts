import { assertEquals, assertRejects } from "@std/assert";
import { Agent, MCPManager, MCPToolset } from "../mod.ts";
import type { MCPCallResult, MCPClient, MCPTool } from "../mod.ts";
import type { RunContext } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Mock MCPClient for testing
// ---------------------------------------------------------------------------

class MockMCPClient implements MCPClient {
  private _tools: MCPTool[];
  private _connected = false;
  private _callResults: Map<string, MCPCallResult>;
  private _serverInstructions: string | undefined;
  connectCallCount = 0;
  disconnectCallCount = 0;
  listToolsCallCount = 0;

  constructor(options?: {
    tools?: MCPTool[];
    callResults?: Map<string, MCPCallResult>;
    serverInstructions?: string;
  }) {
    this._tools = options?.tools ?? [];
    this._callResults = options?.callResults ?? new Map();
    this._serverInstructions = options?.serverInstructions;
  }

  async connect(): Promise<void> {
    this._connected = true;
    this.connectCallCount++;
    await Promise.resolve();
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.disconnectCallCount++;
    await Promise.resolve();
  }

  async listTools(): Promise<MCPTool[]> {
    this.listToolsCallCount++;
    if (!this._connected) throw new Error("Not connected");
    await Promise.resolve();
    return this._tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<MCPCallResult> {
    if (!this._connected) throw new Error("Not connected");
    await Promise.resolve();
    const result = this._callResults.get(name);
    if (result) return result;
    return {
      content: [{ type: "text", text: `${name}(${JSON.stringify(args)})` }],
    };
  }

  getServerInstructions(): string | undefined {
    return this._serverInstructions;
  }
}

// ---------------------------------------------------------------------------
// MCPToolset tests
// ---------------------------------------------------------------------------

Deno.test("MCPToolset - exposes MCP tools to agent", async () => {
  const client = new MockMCPClient({
    tools: [
      {
        name: "search_docs",
        description: "Search documentation",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    ],
  });
  await client.connect();

  let capturedToolNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolNames = (opts.tools ?? []).map((t: { name: string }) =>
        t.name
      );
      return Promise.resolve(textResponse("done"));
    },
  });

  const toolset = new MCPToolset(client);
  const agent = new Agent({ model, toolsets: [toolset] });
  await agent.run("search docs");

  assertEquals(capturedToolNames.includes("search_docs"), true);
});

Deno.test("MCPToolset - tool execution calls client.callTool", async () => {
  let calledName = "";
  let calledArgs: Record<string, unknown> = {};

  const client = new MockMCPClient({
    tools: [
      {
        name: "get_weather",
        description: "Get weather",
        inputSchema: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    ],
    callResults: new Map([
      [
        "get_weather",
        { content: [{ type: "text", text: "Sunny, 72°F" }] },
      ],
    ]),
  });
  await client.connect();

  // Override callTool to capture args
  const origCallTool = client.callTool.bind(client);
  client.callTool = (name: string, args: Record<string, unknown>) => {
    calledName = name;
    calledArgs = args;
    return origCallTool(name, args);
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("get_weather", { city: "Seattle" }),
    textResponse("It is sunny in Seattle"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const toolset = new MCPToolset(client);
  const agent = new Agent({ model, toolsets: [toolset] });
  await agent.run("what's the weather in Seattle?");

  assertEquals(calledName, "get_weather");
  assertEquals(calledArgs["city"], "Seattle");
});

Deno.test("MCPToolset - caches tool list within TTL", async () => {
  const client = new MockMCPClient({
    tools: [
      {
        name: "tool_a",
        description: "Tool A",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
  await client.connect();

  const toolset = new MCPToolset(client, { toolCacheTtlMs: 60_000 });

  // Create a minimal RunContext for testing
  const ctx: RunContext<undefined> = {
    deps: undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  // First call should hit listTools
  await toolset.tools(ctx);
  assertEquals(client.listToolsCallCount, 1);

  // Second call should be cached
  await toolset.tools(ctx);
  assertEquals(client.listToolsCallCount, 1);

  // Invalidate cache, then call again
  toolset.invalidateCache();
  await toolset.tools(ctx);
  assertEquals(client.listToolsCallCount, 2);
});

Deno.test("MCPToolset - TTL expiry triggers re-fetch", async () => {
  const client = new MockMCPClient({
    tools: [
      {
        name: "tool_a",
        description: "Tool A",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
  await client.connect();

  // Very short TTL so it expires immediately
  const toolset = new MCPToolset(client, { toolCacheTtlMs: 0 });

  const ctx: RunContext<undefined> = {
    deps: undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  await toolset.tools(ctx);
  assertEquals(client.listToolsCallCount, 1);

  // Even immediate second call should refetch due to TTL=0
  await toolset.tools(ctx);
  assertEquals(client.listToolsCallCount, 2);
});

Deno.test("MCPToolset - isError throws from tool execution", async () => {
  const client = new MockMCPClient({
    tools: [
      {
        name: "failing_tool",
        description: "Always fails",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    callResults: new Map([
      [
        "failing_tool",
        {
          content: [{ type: "text", text: "Internal server error" }],
          isError: true,
        },
      ],
    ]),
  });
  await client.connect();

  const ctx: RunContext<undefined> = {
    deps: undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  const toolset = new MCPToolset(client);
  const toolDefs = await toolset.tools(ctx);
  assertEquals(toolDefs.length, 1);

  await assertRejects(
    () => toolDefs[0].execute(ctx, {}),
    Error,
    "MCP tool error",
  );
});

Deno.test("MCPToolset - getServerInstructions returns instructions", () => {
  const client = new MockMCPClient({
    serverInstructions: "Use this server for document retrieval.",
  });

  const toolset = new MCPToolset(client);
  assertEquals(
    toolset.getServerInstructions(),
    "Use this server for document retrieval.",
  );
});

Deno.test("MCPToolset - getServerInstructions returns undefined when disabled", () => {
  const client = new MockMCPClient({
    serverInstructions: "Some instructions",
  });

  const toolset = new MCPToolset(client, { instructions: false });
  assertEquals(toolset.getServerInstructions(), undefined);
});

Deno.test("MCPToolset - tool with empty text returns placeholder", async () => {
  const client = new MockMCPClient({
    tools: [
      {
        name: "image_tool",
        description: "Returns an image",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    callResults: new Map([
      [
        "image_tool",
        {
          content: [{
            type: "image",
            data: "base64data",
            mimeType: "image/png",
          }],
        },
      ],
    ]),
  });
  await client.connect();

  const ctx: RunContext<undefined> = {
    deps: undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  const toolset = new MCPToolset(client);
  const toolDefs = await toolset.tools(ctx);
  const result = await toolDefs[0].execute(ctx, {});
  assertEquals(result, "Tool returned non-text content.");
});

// ---------------------------------------------------------------------------
// MCPManager tests
// ---------------------------------------------------------------------------

Deno.test("MCPManager - combines tools from multiple servers", async () => {
  const clientA = new MockMCPClient({
    tools: [
      {
        name: "tool_alpha",
        description: "Alpha",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
  const clientB = new MockMCPClient({
    tools: [
      {
        name: "tool_beta",
        description: "Beta",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });

  const manager = new MCPManager();
  manager.addServer(clientA);
  manager.addServer(clientB);
  await manager.connect();

  assertEquals(clientA.connectCallCount, 1);
  assertEquals(clientB.connectCallCount, 1);

  let capturedToolNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolNames = (opts.tools ?? []).map((t: { name: string }) =>
        t.name
      );
      return Promise.resolve(textResponse("done"));
    },
  });

  const agent = new Agent({ model, toolsets: [manager] });
  await agent.run("go");

  assertEquals(capturedToolNames.includes("tool_alpha"), true);
  assertEquals(capturedToolNames.includes("tool_beta"), true);

  await manager.disconnect();
  assertEquals(clientA.disconnectCallCount, 1);
  assertEquals(clientB.disconnectCallCount, 1);
});

Deno.test("MCPManager - last server wins on name conflict", async () => {
  const clientA = new MockMCPClient({
    tools: [
      {
        name: "shared",
        description: "From A",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
  const clientB = new MockMCPClient({
    tools: [
      {
        name: "shared",
        description: "From B",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });

  const manager = new MCPManager();
  manager.addServer(clientA);
  manager.addServer(clientB);
  await manager.connect();

  const ctx: RunContext<undefined> = {
    deps: undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  const tools = await manager.tools(ctx);
  assertEquals(tools.length, 1);
  assertEquals(tools[0].description, "From B");
});

Deno.test("MCPManager - addServer returns this for chaining", () => {
  const client = new MockMCPClient({ tools: [] });
  const manager = new MCPManager();
  const result = manager.addServer(client);
  assertEquals(result, manager);
  assertEquals(manager.serverCount, 1);
});

Deno.test("MCPManager - aggregates server instructions", () => {
  const clientA = new MockMCPClient({
    serverInstructions: "Instructions from A",
  });
  const clientB = new MockMCPClient({
    serverInstructions: "Instructions from B",
  });

  const manager = new MCPManager();
  manager.addServer(clientA, { name: "server-a" });
  manager.addServer(clientB, { name: "server-b" });

  const instructions = manager.getServerInstructions();
  assertEquals(instructions?.includes("server-a"), true);
  assertEquals(instructions?.includes("Instructions from A"), true);
  assertEquals(instructions?.includes("server-b"), true);
  assertEquals(instructions?.includes("Instructions from B"), true);
});

Deno.test("MCPManager - getServerInstructions returns undefined when no server has instructions", () => {
  const client = new MockMCPClient({ tools: [] });
  const manager = new MCPManager();
  manager.addServer(client);
  assertEquals(manager.getServerInstructions(), undefined);
});

Deno.test("MCPManager - empty manager returns no tools", async () => {
  const manager = new MCPManager();
  const ctx: RunContext<undefined> = {
    deps: undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cachedInputTokens: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  const tools = await manager.tools(ctx);
  assertEquals(tools.length, 0);
});
