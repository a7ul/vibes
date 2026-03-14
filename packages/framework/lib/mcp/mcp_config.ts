import type { MCPServerConfig } from "./mcp_types.ts";
import type { MCPClient } from "./mcp_client.ts";
import { MCPStdioClient } from "./mcp_stdio.ts";
import { MCPHttpClient } from "./mcp_http.ts";
import { MCPManager } from "./mcp_manager.ts";

// ---------------------------------------------------------------------------
// Config file loading
// ---------------------------------------------------------------------------

/**
 * Load MCP server configurations from a JSON file.
 *
 * The file may be either:
 *   - An array of `MCPServerConfig` objects, or
 *   - An object with a top-level `mcpServers` array key (Claude Desktop format)
 *
 * String values in the config may contain `${ENV_VAR}` references which are
 * interpolated from `Deno.env`.
 *
 * @example
 * ```json
 * [
 *   { "type": "stdio", "command": "npx", "args": ["-y", "my-mcp-server"] },
 *   { "type": "http", "url": "https://mcp.example.com" }
 * ]
 * ```
 */
export async function loadMCPConfig(
  configPath: string,
): Promise<MCPServerConfig[]> {
  const raw = await Deno.readTextFile(configPath);
  const interpolated = interpolateEnv(raw);
  const parsed: unknown = JSON.parse(interpolated);

  if (Array.isArray(parsed)) {
    return validateConfigs(parsed);
  }

  // Claude Desktop-style format: { mcpServers: { name: config, ... } }
  if (parsed !== null && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (
      "mcpServers" in obj && obj["mcpServers"] !== null &&
      typeof obj["mcpServers"] === "object"
    ) {
      const servers = obj["mcpServers"] as Record<string, unknown>;
      const configs: MCPServerConfig[] = Object.entries(servers).map(
        ([name, cfg]) => {
          const c = cfg as Record<string, unknown>;
          const base = { name, ...c };
          return base as unknown as MCPServerConfig;
        },
      );
      return validateConfigs(configs);
    }
    // Single server config object
    if ("type" in obj) {
      return validateConfigs([obj]);
    }
  }

  throw new Error(
    `Invalid MCP config file at ${configPath}: expected an array, { mcpServers: {...} }, or a single config object.`,
  );
}

/**
 * Create `MCPClient` instances from an array of `MCPServerConfig` objects.
 * Does not connect - callers must call `connect()` on each client.
 */
export function createClientsFromConfig(
  configs: MCPServerConfig[],
): MCPClient[] {
  return configs.map((cfg) => {
    if (cfg.type === "stdio") {
      return new MCPStdioClient({
        command: cfg.command,
        args: cfg.args,
        env: cfg.env,
      });
    }
    if (cfg.type === "http") {
      return new MCPHttpClient({
        url: cfg.url,
        headers: cfg.headers,
      });
    }
    throw new Error(
      `Unknown MCP server type: ${(cfg as Record<string, unknown>)["type"]}`,
    );
  });
}

/**
 * Convenience function: load a config file, create clients, and return a
 * connected `MCPManager`.
 *
 * @param configPath - Path to the JSON config file.
 * @returns A connected `MCPManager` that aggregates all configured servers.
 *
 * @example
 * ```ts
 * const manager = await createManagerFromConfig("./mcp.config.json");
 * const agent = new Agent({ model, toolsets: [manager] });
 * await agent.run("...");
 * await manager.disconnect();
 * ```
 */
export async function createManagerFromConfig(
  configPath: string,
): Promise<MCPManager> {
  const configs = await loadMCPConfig(configPath);
  const clients = createClientsFromConfig(configs);
  const manager = new MCPManager();
  for (let i = 0; i < clients.length; i++) {
    manager.addServer(clients[i], { name: configs[i].name });
  }
  await manager.connect();
  return manager;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Interpolate ${ENV_VAR} references in a string using Deno.env. */
function interpolateEnv(text: string): string {
  return text.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    const value = Deno.env.get(varName);
    if (value === undefined) {
      throw new Error(
        `MCP config: environment variable "${varName}" is not set.`,
      );
    }
    return value;
  });
}

/** Validate that each element has a recognized `type` field. */
function validateConfigs(items: unknown[]): MCPServerConfig[] {
  return items.map((item, idx) => {
    if (item === null || typeof item !== "object") {
      throw new Error(
        `MCP config[${idx}]: expected an object, got ${typeof item}`,
      );
    }
    const obj = item as Record<string, unknown>;
    if (obj["type"] !== "stdio" && obj["type"] !== "http") {
      throw new Error(
        `MCP config[${idx}]: unknown type "${
          obj["type"]
        }" - expected "stdio" or "http"`,
      );
    }
    if (obj["type"] === "stdio" && typeof obj["command"] !== "string") {
      throw new Error(
        `MCP config[${idx}]: stdio config requires a "command" string`,
      );
    }
    if (obj["type"] === "http" && typeof obj["url"] !== "string") {
      throw new Error(
        `MCP config[${idx}]: http config requires a "url" string`,
      );
    }
    return obj as unknown as MCPServerConfig;
  });
}
