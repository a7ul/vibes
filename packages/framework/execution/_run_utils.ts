/**
 * Internal helpers shared between run.ts (non-streaming) and stream.ts (streaming).
 * Not part of the public API.
 */
import {
	tool as aiTool,
	type LanguageModel,
	type LanguageModelUsage,
	type ModelMessage,
	type ToolSet,
} from "ai";
import type { Agent } from "../agent.ts";
import type { HistoryProcessor } from "../history_processor.ts";
import type { ResultValidator, RunContext, Usage } from "../types.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "../toolsets/toolset.ts";
import type { UsageLimits } from "../usage_limits.ts";
import { createUsage } from "../types.ts";
import { toAISDKTools } from "../tool.ts";
import { checkUsageLimits } from "../usage_limits.ts";
import { MaxRetriesError } from "../errors.ts";
import { applyHistoryProcessors } from "../history_processor.ts";
import { assertModelRequestsAllowed, _notifyModelRequest } from "../testing.ts";

// ---------------------------------------------------------------------------
// Public opts type for execute functions
// ---------------------------------------------------------------------------

/** Internal options passed to executeRun / executeStream. */
export interface InternalRunOpts<TDeps, TOutput> {
	deps: TDeps;
	messageHistory?: ModelMessage[];
	metadata?: Record<string, unknown>;
	/** Per-run usage limits (overrides agent-level limits when set). */
	usageLimits?: UsageLimits;
	/** Populated by Agent.override(); replaces corresponding agent fields for this run. */
	_override?: {
		model?: LanguageModel;
		systemPrompts?: Array<string | ((ctx: RunContext<TDeps>) => string | Promise<string>)>;
		tools?: ReadonlyArray<ToolDefinition<TDeps>>;
		toolsets?: ReadonlyArray<Toolset<TDeps>>;
		historyProcessors?: ReadonlyArray<HistoryProcessor<TDeps>>;
		resultValidators?: ReadonlyArray<ResultValidator<TDeps, TOutput>>;
		maxRetries?: number;
		maxTurns?: number;
		usageLimits?: UsageLimits;
	};
	/** When true, bypasses the ALLOW_MODEL_REQUESTS guard (set by agent.override()). */
	_bypassModelRequestsCheck?: boolean;
}

// ---------------------------------------------------------------------------
// Context / message helpers
// ---------------------------------------------------------------------------

export function createRunContext<TDeps>(
	deps: TDeps,
	metadata: Record<string, unknown>,
): RunContext<TDeps> {
	return {
		deps,
		usage: createUsage(),
		retryCount: 0,
		toolName: null,
		runId: globalThis.crypto.randomUUID(),
		metadata,
	};
}

export async function resolveSystemPrompt<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	ctx: RunContext<TDeps>,
	overrideSystemPrompts?: Array<
		string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
	>,
): Promise<string | undefined> {
	const prompts = overrideSystemPrompts ?? [...agent.systemPrompts];
	const parts: string[] = [];
	for (const p of prompts) {
		parts.push(typeof p === "string" ? p : await p(ctx));
	}
	return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function buildInitialMessages(
	messageHistory: ModelMessage[] | undefined,
	prompt: string,
): ModelMessage[] {
	return [...(messageHistory ?? []), { role: "user", content: prompt }];
}

// ---------------------------------------------------------------------------
// Tool resolution — called per-turn to support prepare() and dynamic toolsets
// ---------------------------------------------------------------------------

/**
 * Resolves all tools for a single model turn. Calls `prepare()` on each tool
 * to allow dynamic inclusion/exclusion, and flattens toolsets.
 */
export async function resolveTools<TDeps>(
	tools: ReadonlyArray<ToolDefinition<TDeps>>,
	toolsets: ReadonlyArray<Toolset<TDeps>>,
	ctx: RunContext<TDeps>,
): Promise<ToolDefinition<TDeps>[]> {
	const resolved: ToolDefinition<TDeps>[] = [];

	for (const t of tools) {
		if (t.prepare) {
			const prepared = await t.prepare(ctx);
			if (prepared !== null && prepared !== undefined) {
				resolved.push(prepared);
			}
		} else {
			resolved.push(t);
		}
	}

	for (const ts of toolsets) {
		const tsTools = await ts.tools(ctx);
		// Toolset tools also support prepare
		for (const t of tsTools) {
			if (t.prepare) {
				const prepared = await t.prepare(ctx);
				if (prepared !== null && prepared !== undefined) {
					resolved.push(prepared);
				}
			} else {
				resolved.push(t);
			}
		}
	}

	return resolved;
}

// ---------------------------------------------------------------------------
// Tool map builder
// ---------------------------------------------------------------------------

export const FINAL_RESULT_TOOL = "final_result";

export function buildResponseMessages(
	responseMessages: ModelMessage[],
	accumulatedText: string,
): ModelMessage[] {
	if (responseMessages.length > 0) return responseMessages;
	if (accumulatedText.length > 0) {
		return [
			{
				role: "assistant" as const,
				content: [{ type: "text" as const, text: accumulatedText }],
			},
		];
	}
	return [];
}

export function buildToolMap<TDeps>(
	resolvedTools: ToolDefinition<TDeps>[],
	outputSchema: import("zod").ZodTypeAny | undefined,
	ctx: RunContext<TDeps>,
): ToolSet {
	const toolMap = toAISDKTools(resolvedTools, () => ctx);
	if (outputSchema) {
		toolMap[FINAL_RESULT_TOOL] = aiTool({
			description: "Return the final structured result.",
			inputSchema: outputSchema,
			// Passthrough execute so the SDK includes the result in response.response.messages.
			execute: (input) => Promise.resolve(input),
		});
	}
	return toolMap;
}

export function toolsOrUndefined(toolMap: ToolSet): ToolSet | undefined {
	return Object.keys(toolMap).length > 0 ? toolMap : undefined;
}

// ---------------------------------------------------------------------------
// Usage helper
// ---------------------------------------------------------------------------

export function applyUsage(usage: Usage, reported: LanguageModelUsage): void {
	usage.inputTokens += reported.inputTokens ?? 0;
	usage.outputTokens += reported.outputTokens ?? 0;
	usage.totalTokens += reported.totalTokens ?? 0;
	usage.requests += 1;
}

// ---------------------------------------------------------------------------
// Result validator runner
// ---------------------------------------------------------------------------

export async function runValidators<TDeps, TOutput>(
	validators: ReadonlyArray<ResultValidator<TDeps, TOutput>>,
	ctx: RunContext<TDeps>,
	output: TOutput,
): Promise<TOutput> {
	let result = output;
	for (const v of validators) {
		result = await v(ctx, result);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Nudge helpers — push a retry user message and throw if retries exhausted
// ---------------------------------------------------------------------------

export function nudgeForFinalResult<TDeps>(
	ctx: RunContext<TDeps>,
	messages: ModelMessage[],
	maxRetries: number,
): void {
	if (ctx.retryCount >= maxRetries) throw new MaxRetriesError(maxRetries);
	ctx.retryCount++;
	messages.push({
		role: "user",
		content: `Please use the \`${FINAL_RESULT_TOOL}\` tool to return your answer in the required format.`,
	});
}

export function nudgeWithValidationError<TDeps>(
	ctx: RunContext<TDeps>,
	messages: ModelMessage[],
	maxRetries: number,
	error: Error,
): void {
	if (ctx.retryCount >= maxRetries)
		throw new MaxRetriesError(maxRetries, error);
	ctx.retryCount++;
	messages.push({
		role: "user",
		content: `Result validation failed: ${error.message}. Please try again.`,
	});
}

// ---------------------------------------------------------------------------
// Pre-turn setup helper — runs limits check, resolves tools, applies processors
// ---------------------------------------------------------------------------

export interface TurnSetup<TDeps> {
	toolMap: ToolSet;
	tools: ToolSet | undefined;
	msgsForModel: ModelMessage[];
}

export async function prepareTurn<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	opts: InternalRunOpts<TDeps, TOutput>,
	ctx: RunContext<TDeps>,
	messages: ModelMessage[],
): Promise<TurnSetup<TDeps>> {
	// Check usage limits (agent-level, then per-run override)
	const limits = opts._override?.usageLimits ?? opts.usageLimits ?? agent.usageLimits;
	if (limits) checkUsageLimits(limits, ctx.usage);

	const tools = opts._override?.tools ?? agent.tools;
	const toolsets = opts._override?.toolsets ?? agent.toolsets;
	const resolvedTools = await resolveTools(tools, toolsets, ctx);
	const toolMap = buildToolMap(resolvedTools, agent.outputSchema, ctx);

	const historyProcessors = opts._override?.historyProcessors ?? agent.historyProcessors;
	const msgsForModel = await applyHistoryProcessors(historyProcessors, messages, ctx);

	// Notify capture store
	_notifyModelRequest(msgsForModel);

	return { toolMap, tools: toolsOrUndefined(toolMap), msgsForModel };
}

// ---------------------------------------------------------------------------
// Model request guard
// ---------------------------------------------------------------------------

export function checkModelRequestsAllowed(bypass = false): void {
	assertModelRequestsAllowed(bypass);
}

// ---------------------------------------------------------------------------
// Re-exported helpers for run.ts / stream.ts
// ---------------------------------------------------------------------------

export { checkUsageLimits, applyHistoryProcessors };
