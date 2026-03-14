import { Client } from "npm:@modelcontextprotocol/sdk@^1/client/index.js";
import { StdioClientTransport } from "npm:@modelcontextprotocol/sdk@^1/client/stdio.js";
import type { MCPClient } from "./mcp_client.ts";
import type { MCPTool, MCPCallResult, MCPContentItem, ElicitationCallback } from "./mcp_types.ts";

// ---------------------------------------------------------------------------
// MCPStdioClient — stdio transport (subprocess)
// ---------------------------------------------------------------------------

/** Configuration for an stdio-based MCP server. */
export type MCPStdioConfig = {
	command: string;
	args?: string[];
	env?: Record<string, string>;
};

/**
 * MCP client that communicates with a server via stdio (subprocess).
 * Spawns the given command as a child process and speaks the MCP JSON-RPC
 * protocol over stdin/stdout.
 *
 * @example
 * ```ts
 * const client = new MCPStdioClient({ command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] });
 * await client.connect();
 * const tools = await client.listTools();
 * ```
 */
export class MCPStdioClient implements MCPClient {
	private _config: MCPStdioConfig;
	private _client: Client | null = null;
	private _serverInstructions: string | undefined;
	private _elicitationCallback: ElicitationCallback | undefined;

	constructor(
		config: MCPStdioConfig,
		options?: { elicitationCallback?: ElicitationCallback },
	) {
		this._config = config;
		this._elicitationCallback = options?.elicitationCallback;
	}

	async connect(): Promise<void> {
		const transport = new StdioClientTransport({
			command: this._config.command,
			args: this._config.args,
			env: this._config.env,
		});

		const client = new Client(
			{ name: "vibes-framework", version: "0.1.0" },
			{ capabilities: {} },
		);

		await client.connect(transport);
		this._client = client;

		// Extract server instructions if provided in the server info
		const serverInfo = client.getServerVersion();
		if (serverInfo && typeof serverInfo === "object" && "instructions" in serverInfo) {
			this._serverInstructions = serverInfo.instructions as string | undefined;
		}

		// Register elicitation handler if callback provided
		if (this._elicitationCallback) {
			this._registerElicitationHandler(client);
		}
	}

	async disconnect(): Promise<void> {
		if (this._client) {
			await this._client.close();
			this._client = null;
		}
	}

	async listTools(): Promise<MCPTool[]> {
		const client = this._assertConnected();
		const result = await client.listTools();
		return result.tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema as Record<string, unknown>,
		}));
	}

	async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
		const client = this._assertConnected();
		const result = await client.callTool({ name, arguments: args });

		const content: MCPContentItem[] = (result.content as unknown[]).map((item) => {
			const c = item as Record<string, unknown>;
			if (c["type"] === "image") {
				return {
					type: "image" as const,
					data: c["data"] as string,
					mimeType: c["mimeType"] as string,
				};
			}
			return {
				type: "text" as const,
				text: c["text"] as string ?? String(c),
			};
		});

		return {
			content,
			isError: result.isError as boolean | undefined,
		};
	}

	getServerInstructions(): string | undefined {
		return this._serverInstructions;
	}

	private _assertConnected(): Client {
		if (!this._client) {
			throw new Error("MCPStdioClient: not connected. Call connect() first.");
		}
		return this._client;
	}

	private _registerElicitationHandler(client: Client): void {
		// The MCP SDK exposes elicitation via setRequestHandler for elicit requests
		// We use the generic request handler mechanism if available
		try {
			// deno-lint-ignore no-explicit-any
			const c = client as any;
			if (typeof c.setRequestHandler === "function") {
				c.setRequestHandler(
					{ method: "elicitation/create" },
					async (req: { params: { message: string; requestedSchema: Record<string, unknown> } }) => {
						const cb = this._elicitationCallback!;
						const response = await cb({
							message: req.params.message,
							schema: req.params.requestedSchema,
						});
						return { action: "accept", content: response };
					},
				);
			}
		} catch {
			// Elicitation not supported by this server version — ignore
		}
	}
}
