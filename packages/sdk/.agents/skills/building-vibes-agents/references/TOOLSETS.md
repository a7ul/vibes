# Toolsets

Read this file when the user wants to use `FunctionToolset`, `FilteredToolset`, `PrefixedToolset`, `WrapperToolset`, `PreparedToolset`, `CombinedToolset`, MCP servers, or other toolset types.

## What is a Toolset?

A toolset is a composable collection of tools that can be resolved dynamically at the start of each model turn. Unlike the static `tools` array, toolsets receive a `RunContext` and can decide which tools to expose based on runtime state — user role, workflow phase, feature flags, etc.

```typescript
const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  tools: [alwaysAvailableTool],   // static — always present
  toolsets: [conditionalToolset], // resolved fresh each turn
});
```

## FunctionToolset — Basic Collection

`FunctionToolset` groups related tool definitions into a named collection. Use it when you have multiple logically related tools that should be managed as a unit.

```typescript
import { FunctionToolset, plainTool } from "@vibesjs/sdk";
import { z } from "zod";

const searchTool = plainTool({
  name: "search",
  description: "Search documents",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => doSearch(query),
});

const fetchTool = plainTool({
  name: "fetch_url",
  description: "Fetch a URL",
  parameters: z.object({ url: z.string().url() }),
  execute: async ({ url }) => fetchPage(url),
});

const webTools = new FunctionToolset([searchTool, fetchTool]);
webTools.addTool(anotherTool); // add tools after construction

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  toolsets: [webTools],
});
```

## FilteredToolset — All-or-Nothing Gating

`FilteredToolset` wraps another toolset and hides it entirely when a predicate returns `false`. Use for role-based or phase-based tool gating.

```typescript
import { FilteredToolset, FunctionToolset, RunContext } from "@vibesjs/sdk";

type Deps = { user: { isAdmin: boolean } };

const adminTools = new FunctionToolset([deleteRecordTool, exportDataTool]);

const gatedAdminTools = new FilteredToolset(
  adminTools,
  (ctx: RunContext<Deps>) => ctx.deps.user.isAdmin,
);

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  toolsets: [gatedAdminTools],
});
```

## PrefixedToolset — Namespace Tool Names

`PrefixedToolset` adds a prefix to all tool names. Use to avoid naming collisions when combining toolsets.

```typescript
import { PrefixedToolset, FunctionToolset } from "@vibesjs/sdk";

const dbTools = new FunctionToolset([queryTool, insertTool]);
const prefixedDbTools = new PrefixedToolset(dbTools, "db_");
// Tools become: "db_query", "db_insert"
```

## CombinedToolset — Merge Multiple Toolsets

`CombinedToolset` merges multiple toolsets into one. The agent sees all tools from all inner toolsets.

```typescript
import { CombinedToolset } from "@vibesjs/sdk";

const allTools = new CombinedToolset(webTools, dbTools, calendarTools);
```

## PreparedToolset — Dynamic Tool List Per Turn

`PreparedToolset` calls a function before each turn to transform the list of tools. Use for dynamic tool filtering, modification, or injection.

```typescript
import { PreparedToolset, FunctionToolset } from "@vibesjs/sdk";

const baseTools = new FunctionToolset([tool1, tool2, tool3]);

const dynamicTools = new PreparedToolset(
  baseTools,
  async (ctx, tools) => {
    // Return modified tool list for this turn
    return tools.filter((t) => !ctx.metadata?.excludedTools?.includes(t.name));
  },
);
```

## WrapperToolset — Custom Execution Behaviour

Subclass `WrapperToolset` to intercept tool calls with custom pre/post-execution logic:

```typescript
import { WrapperToolset, FunctionToolset, RunContext, ToolDefinition } from "@vibesjs/sdk";

class LoggingToolset<TDeps> extends WrapperToolset<TDeps> {
  async callTool(
    ctx: RunContext<TDeps>,
    tool: ToolDefinition<TDeps>,
    args: Record<string, unknown>,
  ) {
    console.log(`Calling tool: ${tool.name}`, args);
    const result = await super.callTool(ctx, tool, args);
    console.log(`Tool result: ${tool.name}`, result);
    return result;
  }
}

const wrappedTools = new LoggingToolset(new FunctionToolset([myTool]));
```

## ApprovalRequiredToolset — Human-in-the-Loop

`ApprovalRequiredToolset` marks all tools as requiring human approval before execution:

```typescript
import { ApprovalRequiredToolset, FunctionToolset } from "@vibesjs/sdk";

const riskyTools = new FunctionToolset([deleteFileTool, sendEmailTool]);
const approvedTools = new ApprovalRequiredToolset(riskyTools);

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  toolsets: [approvedTools],
});

try {
  const result = await agent.run("Delete old files");
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    const deferred = err.deferredRequests;
    // Inspect deferred.requests, approve or deny
    const results = deferred.approveAll();
    const result = await agent.resume(deferred, results);
  }
}
```

## MCP Servers as Toolsets

Connect MCP servers directly as toolsets. The agent treats an MCP server exactly like any other toolset.

```typescript
import { Agent } from "@vibesjs/sdk";
import { MCPClient } from "@vibesjs/sdk";

const mcpClient = new MCPClient({
  transport: { type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] },
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  toolsets: [mcpClient.toolset()],
});

// Connect before running
await mcpClient.connect();
const result = await agent.run("List files in the current directory");
await mcpClient.close();
```

## Toolset Lifecycle Hooks

Toolsets can implement optional lifecycle hooks:

- `forRun(ctx)` — called once before the first turn; use for per-run state setup
- `forRunStep(ctx)` — called at the start of each turn; use for per-turn state setup
- `getInstructions(ctx)` — returns instructions injected into the system prompt each turn

```typescript
class StatefulToolset<TDeps> extends FunctionToolset<TDeps> {
  async forRun(ctx: RunContext<TDeps>): Promise<void> {
    // Initialize per-run state
  }

  async forRunStep(ctx: RunContext<TDeps>): Promise<void> {
    // Reset per-turn state
  }

  async getInstructions(ctx: RunContext<TDeps>): Promise<string[] | null> {
    return ["Use these tools carefully. Always verify before deleting."];
  }
}
```

## DeferredLoadingToolset and ToolSearchToolset

For large toolsets where you don't want to send all tools to the model at once:

```typescript
import { DeferredLoadingToolset, ToolSearchToolset } from "@vibesjs/sdk";

// Mark all tools in the toolset as deferred (hidden until discovered)
const bigToolset = new DeferredLoadingToolset(new FunctionToolset(manyTools));

// Add a search tool that lets the model discover deferred tools
const searchableToolset = new ToolSearchToolset(bigToolset);

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  toolsets: [searchableToolset], // model can use search_tools to discover tools
});
```
