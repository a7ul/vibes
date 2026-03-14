import type { z, ZodTypeAny } from "zod";
import type { RunContext } from "../types.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * The `next` function passed to `callTool` — invokes the wrapped tool's
 * original `execute` implementation.
 */
export type ToolCallNext<TDeps> = (
	ctx: RunContext<TDeps>,
	args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Abstract base class that intercepts every tool execution in the wrapped
 * toolset. Subclasses override `callTool` to add middleware behaviour such as
 * logging, metrics, rate-limiting, error wrapping, or argument/result
 * transformation.
 *
 * Equivalent to pydantic-ai's `WrapperToolset` / middleware pattern.
 *
 * @example
 * ```ts
 * class LoggingToolset extends WrapperToolset<MyDeps> {
 *   async callTool(ctx, toolName, args, next) {
 *     console.log(`calling ${toolName}`, args);
 *     const result = await next(ctx, args);
 *     console.log(`${toolName} returned`, result);
 *     return result;
 *   }
 * }
 *
 * const agent = new Agent({ model, toolsets: [new LoggingToolset(myTools)] });
 * ```
 */
export abstract class WrapperToolset<TDeps = undefined> implements Toolset<TDeps> {
	private readonly _inner: Toolset<TDeps>;

	constructor(inner: Toolset<TDeps>) {
		this._inner = inner;
	}

	/**
	 * Override this method to intercept tool execution.
	 *
	 * @param ctx       - The current run context.
	 * @param toolName  - Name of the tool being called.
	 * @param args      - Parsed arguments the model passed to the tool.
	 * @param next      - Call this to invoke the underlying tool implementation.
	 *                    You may modify `ctx` or `args` before passing them, or
	 *                    transform the return value afterwards.
	 */
	abstract callTool(
		ctx: RunContext<TDeps>,
		toolName: string,
		args: Record<string, unknown>,
		next: ToolCallNext<TDeps>,
	): Promise<unknown>;

	async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
		const innerTools = await this._inner.tools(ctx);
		// `this` must be captured before the map so the closure retains the
		// correct WrapperToolset instance.
		const wrapper = this;

		return innerTools.map((t): ToolDefinition<TDeps> => {
			const originalExecute = t.execute;

			return {
				...t,
				// The ToolDefinition.execute signature uses `z.infer<ZodTypeAny>`
				// which resolves to `unknown`. We accept `unknown` here and cast to
				// `Record<string, unknown>` when forwarding to callTool, since the AI
				// SDK will always supply a parsed object at runtime.
				execute: (execCtx: RunContext<TDeps>, args: z.infer<ZodTypeAny>) => {
					const argsRecord = args as Record<string, unknown>;
					const next: ToolCallNext<TDeps> = (nextCtx, nextArgs) =>
						originalExecute(nextCtx, nextArgs);

					return wrapper.callTool(execCtx, t.name, argsRecord, next) as ReturnType<
						typeof originalExecute
					>;
				},
			};
		});
	}
}
