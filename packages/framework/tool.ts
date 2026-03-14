import type { z, ZodTypeAny } from "zod";
import { tool as aiTool, type ToolSet } from "ai";
import type { RunContext } from "./types/run_context.ts";

export interface ToolDefinition<TDeps = undefined> {
	name: string;
	description: string;
	parameters: ZodTypeAny;
	execute: (
		ctx: RunContext<TDeps>,
		args: z.infer<ZodTypeAny>,
	) => Promise<string | object>;
	maxRetries?: number;
}

/**
 * Define a typed tool with Zod parameter validation.
 *
 * @example
 * const search = tool<MyDeps, typeof SearchParams>({
 *   name: "search",
 *   description: "Search the web",
 *   parameters: z.object({ query: z.string() }),
 *   execute: async (ctx, args) => fetchResults(args.query),
 * });
 */
export function tool<
	TDeps = undefined,
	TParams extends ZodTypeAny = ZodTypeAny,
>(opts: {
	name: string;
	description: string;
	parameters: TParams;
	execute: (
		ctx: RunContext<TDeps>,
		args: z.infer<TParams>,
	) => Promise<string | object>;
	maxRetries?: number;
}): ToolDefinition<TDeps> {
	return opts as ToolDefinition<TDeps>;
}

/**
 * Convert our ToolDefinition array into the format expected by Vercel AI SDK's
 * generateText/streamText `tools` option. Execution is wired through the provided
 * RunContext so tools have access to deps, usage, etc.
 */
export function toAISDKTools<TDeps>(
	tools: ReadonlyArray<ToolDefinition<TDeps>>,
	getCtx: () => RunContext<TDeps>,
): ToolSet {
	const result: ToolSet = {};
	for (const t of tools) {
		result[t.name] = aiTool({
			description: t.description,
			inputSchema: t.parameters,
			execute: async (args: z.infer<ZodTypeAny>) => {
				const ctx = getCtx();
				const prev = ctx.toolName;
				ctx.toolName = t.name;
				const attempts = (t.maxRetries ?? 0) + 1;
				let lastErr: unknown;
				try {
					for (let i = 0; i < attempts; i++) {
						try {
							return await t.execute(ctx, args);
						} catch (err) {
							lastErr = err;
						}
					}
					throw lastErr;
				} finally {
					ctx.toolName = prev;
				}
			},
		});
	}
	return result;
}
