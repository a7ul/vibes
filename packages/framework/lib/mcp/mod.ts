// ---------------------------------------------------------------------------
// MCP (Model Context Protocol) integration
// ---------------------------------------------------------------------------

export type {
  ElicitationCallback,
  ElicitationRequest,
  MCPCallResult,
  MCPContentItem,
  MCPImageContent,
  MCPServerConfig,
  MCPTextContent,
  MCPTool,
} from "./mcp_types.ts";

export type { MCPClient } from "./mcp_client.ts";

export { MCPStdioClient } from "./mcp_stdio.ts";
export type { MCPStdioConfig } from "./mcp_stdio.ts";

export { MCPHttpClient } from "./mcp_http.ts";
export type { MCPHttpConfig } from "./mcp_http.ts";

export { MCPToolset } from "./mcp_toolset.ts";
export type { MCPToolsetOptions } from "./mcp_toolset.ts";

export { MCPManager } from "./mcp_manager.ts";

export {
  createClientsFromConfig,
  createManagerFromConfig,
  loadMCPConfig,
} from "./mcp_config.ts";
