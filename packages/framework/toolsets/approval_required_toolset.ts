import type { RunContext } from "../types.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "./toolset.ts";

/**
 * Wraps any toolset and marks all its tools as requiring human approval
 * before execution. When the model calls any of these tools, the run pauses
 * and throws an `ApprovalRequiredError` with a `DeferredToolRequests` object.
 *
 * The caller can inspect pending requests, then call `agent.resume()` with
 * approved results to continue.
 *
 * @example
 * ```ts
 * const safeSearch = new ApprovalRequiredToolset(searchToolset);
 * const agent = new Agent({ model, toolsets: [safeSearch] });
 *
 * try {
 *   await agent.run("Search for something sensitive");
 * } catch (err) {
 *   if (err instanceof ApprovalRequiredError) {
 *     // Review err.deferred.requests, then resume
 *     const result = await agent.resume(err.deferred, { results: [...] });
 *   }
 * }
 * ```
 */
export class ApprovalRequiredToolset<TDeps = undefined> implements Toolset<TDeps> {
	constructor(private readonly inner: Toolset<TDeps>) {}

	async tools(ctx: RunContext<TDeps>): Promise<ToolDefinition<TDeps>[]> {
		const innerTools = await this.inner.tools(ctx);
		return innerTools.map((t) => ({
			...t,
			requiresApproval: true as const,
		}));
	}
}
