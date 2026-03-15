import type { MCPCallResult, MCPTool } from "./mcp_types.ts";

// ---------------------------------------------------------------------------
// MCPClient interface
// ---------------------------------------------------------------------------

/**
 * Base interface for MCP client implementations.
 * Concrete implementations connect to MCP servers via different transports
 * (stdio, HTTP, etc.) and expose the server's tools to the framework.
 */
export interface MCPClient {
  /** Connect to the MCP server. Must be called before any other method. */
  connect(): Promise<void>;

  /** Disconnect from the MCP server and clean up resources. */
  disconnect(): Promise<void>;

  /** List all tools available on the connected MCP server. */
  listTools(): Promise<MCPTool[]>;

  /**
   * Call a tool on the MCP server.
   * @param name - The name of the tool to call.
   * @param args - The arguments to pass to the tool.
   */
  callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult>;

  /**
   * Returns server-level instructions if provided during initialization.
   * Agents may include these in their system prompt.
   */
  getServerInstructions(): string | undefined;
}
