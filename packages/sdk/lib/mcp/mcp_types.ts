// ---------------------------------------------------------------------------
// Shared MCP types
// ---------------------------------------------------------------------------

/** A tool exposed by an MCP server. */
export type MCPTool = {
  name: string;
  description?: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
};

/** A single content item returned by an MCP tool call. */
export type MCPTextContent = { type: "text"; text: string };
export type MCPImageContent = { type: "image"; data: string; mimeType: string };
export type MCPContentItem = MCPTextContent | MCPImageContent;

/** The result of calling an MCP tool. */
export type MCPCallResult = {
  content: MCPContentItem[];
  isError?: boolean;
};

/** Configuration for an MCP server. */
export type MCPServerConfig =
  | {
    type: "stdio";
    name?: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }
  | {
    type: "http";
    name?: string;
    url: string;
    headers?: Record<string, string>;
  };

/** A request from an MCP server asking for user input. */
export type ElicitationRequest = {
  message: string;
  schema: Record<string, unknown>;
};

/** A callback invoked when the MCP server sends an elicitation request. */
export type ElicitationCallback = (
  request: ElicitationRequest,
) => Promise<Record<string, unknown>>;
