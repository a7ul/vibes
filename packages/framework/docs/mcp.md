# MCP (Model Context Protocol)

Connect agents to external MCP tool servers over stdio or HTTP, exposing their
tools as native framework tools.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) is an open
standard for connecting AI models to external tool servers. MCP servers expose
tools over a transport (stdio subprocess or HTTP/SSE) and the framework
translates them into `ToolDefinition` objects the agent can call.

## `MCPStdioClient`

Connect to an MCP server running as a subprocess:

```ts
import { MCPStdioClient, MCPToolset } from "@vibes/framework";

const client = new MCPStdioClient({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
});

await client.connect();

const toolset = new MCPToolset(client);
const agent = new Agent({ model, toolsets: [toolset] });

const result = await agent.run("List files in /tmp");

await client.disconnect();
```

## `MCPHttpClient`

Connect to an MCP server over HTTP/SSE:

```ts
import { MCPHttpClient, MCPToolset } from "@vibes/framework";

const client = new MCPHttpClient({
  url: "https://my-mcp-server.example.com/mcp",
  headers: { Authorization: `Bearer ${apiKey}` },
});

await client.connect();
const toolset = new MCPToolset(client);
```

## `MCPToolset`

Wraps an `MCPClient` and implements the `Toolset` interface. On each turn it
fetches the server's current tool list and translates them for the agent:

```ts
const toolset = new MCPToolset(client);
const agent = new Agent({ model, toolsets: [toolset] });
```

Server instructions (if provided during MCP initialization) can be added to the
agent's system prompt:

```ts
await client.connect();
const instructions = client.getServerInstructions();

const agent = new Agent({
  model,
  systemPrompt: instructions
    ? `You have access to tools.\n\n${instructions}`
    : "You have access to tools.",
  toolsets: [new MCPToolset(client)],
});
```

## `MCPManager`

Manages multiple MCP clients as a single unit — connect, use, and disconnect all
clients together:

```ts
import { MCPHttpClient, MCPManager, MCPStdioClient } from "@vibes/framework";

const manager = new MCPManager([
  new MCPStdioClient({
    command: "npx",
    args: ["-y", "@mcp/filesystem", "/data"],
  }),
  new MCPHttpClient({ url: "https://search-mcp.example.com/mcp" }),
]);

await manager.connectAll();

// Get a combined toolset from all managed clients
const toolset = manager.toolset();
const agent = new Agent({ model, toolsets: [toolset] });

await agent.run("Search for TypeScript tutorials and list /data/docs");

await manager.disconnectAll();
```

## Config File Loading

Load MCP server configuration from a JSON file (compatible with Claude Desktop
config format):

```ts
import { loadMCPConfig, MCPManager } from "@vibes/framework";

const config = await loadMCPConfig("./mcp-config.json");
const manager = MCPManager.fromConfig(config);

await manager.connectAll();
```

Example `mcp-config.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
    },
    "search": {
      "url": "https://search-mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer sk-..." }
    }
  }
}
```

## `MCPClient` Interface

| Method                  | Signature                                | Description                     |
| ----------------------- | ---------------------------------------- | ------------------------------- |
| `connect`               | `() => Promise<void>`                    | Connect to the server           |
| `disconnect`            | `() => Promise<void>`                    | Disconnect and clean up         |
| `listTools`             | `() => Promise<MCPTool[]>`               | List available tools            |
| `callTool`              | `(name, args) => Promise<MCPCallResult>` | Invoke a tool                   |
| `getServerInstructions` | `() => string \| undefined`              | Server-level system prompt hint |

## `MCPStdioClient` Options

| Option    | Type                     | Description                     |
| --------- | ------------------------ | ------------------------------- |
| `command` | `string`                 | Executable to run               |
| `args`    | `string[]`               | Arguments passed to the command |
| `env`     | `Record<string, string>` | Extra environment variables     |

## `MCPHttpClient` Options

| Option    | Type                     | Description              |
| --------- | ------------------------ | ------------------------ |
| `url`     | `string`                 | MCP server endpoint      |
| `headers` | `Record<string, string>` | HTTP headers (e.g. auth) |

## Error Behavior

- `connect()` throws if the server process fails to start or the HTTP endpoint
  is unreachable.
- Tool call errors from the MCP server are returned as `MCPCallResult` with
  `isError: true` — the framework surfaces these as tool error messages to the
  model.
- Always call `disconnect()` (or `manager.disconnectAll()`) after use to avoid
  orphaned subprocesses.
- If `listTools()` fails during a turn, that turn throws and the run fails.
  Guard with try/catch if server availability is uncertain.
