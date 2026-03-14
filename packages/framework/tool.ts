import type { z, ZodTypeAny } from "zod";
import { tool as aiTool, type ToolSet } from "ai";
import type { RunContext } from "./types.ts";

export interface ToolDefinition<TDeps = undefined> {
	name: string;
	description: string;
	parameters: ZodTypeAny;
	execute: (
		ctx: RunContext<TDeps>,
		args: z.infer<ZodTypeAny>,
	) => Promise<string | object>;
	/** Max times to retry this tool on failure before propagating the error. */
	maxRetries?: number;
	/**
	 * Cross-field validation run before `execute`. Throw to reject the args and
	 * surface an error without consuming a retry.
	 */
	argsValidator?: (args: z.infer<ZodTypeAny>) => void | Promise<void>;
	/**
	 * Called once per model turn before the tools are sent to the model.
	 * Return the (possibly modified) tool definition to include it, or
	 * `null`/`undefined` to exclude it from this turn.
	 */
	prepare?: (
		ctx: RunContext<TDeps>,
	) =>
		| ToolDefinition<TDeps>
		| null
		| undefined
		| Promise<ToolDefinition<TDeps> | null | undefined>;
}

/**
 * Define a typed tool with Zod parameter validation.
 *
 * @example
 * ```ts
 * const search = tool<MyDeps, typeof SearchParams>({
 *   name: "search",
 *   description: "Search the web",
 *   parameters: z.object({ query: z.string() }),
 *   execute: async (ctx, args) => fetchResults(args.query),
 * });
 * ```
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
	argsValidator?: (args: z.infer<TParams>) => void | Promise<void>;
	prepare?: (
		ctx: RunContext<TDeps>,
	) =>
		| ToolDefinition<TDeps>
		| null
		| undefined
		| Promise<ToolDefinition<TDeps> | null | undefined>;
}): ToolDefinition<TDeps> {
	return opts as ToolDefinition<TDeps>;
}

/**
 * Define a tool that does not need the `RunContext`. Simpler signature when
 * your tool has no dependency injection requirements.
 * Equivalent to pydantic-ai's `@agent.tool_plain`.
 *
 * @example
 * ```ts
 * const add = plainTool({
 *   name: "add",
 *   description: "Add two numbers",
 *   parameters: z.object({ a: z.number(), b: z.number() }),
 *   execute: async ({ a, b }) => String(a + b),
 * });
 * ```
 */
export function plainTool<TParams extends ZodTypeAny = ZodTypeAny>(opts: {
	name: string;
	description: string;
	parameters: TParams;
	execute: (args: z.infer<TParams>) => Promise<string | object>;
	maxRetries?: number;
	argsValidator?: (args: z.infer<TParams>) => void | Promise<void>;
}): ToolDefinition<undefined> {
	return {
		name: opts.name,
		description: opts.description,
		parameters: opts.parameters,
		maxRetries: opts.maxRetries,
		argsValidator: opts.argsValidator
			? (args: z.infer<ZodTypeAny>) => opts.argsValidator!(args as z.infer<TParams>)
			: undefined,
		execute: (_ctx, args: z.infer<ZodTypeAny>) => opts.execute(args as z.infer<TParams>),
	};
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
					if (t.argsValidator) {
						await t.argsValidator(args);
					}
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
