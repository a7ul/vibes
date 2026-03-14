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
import type { Agent, EndStrategy } from "../agent.ts";
import type { HistoryProcessor } from "../history_processor.ts";
import type { ResultValidator, RunContext, Usage } from "../types.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "../toolsets/toolset.ts";
import type { UsageLimits } from "../usage_limits.ts";
import type { ModelSettings } from "../model_settings.ts";
import { createUsage } from "../types.ts";
import { toAISDKTools } from "../tool.ts";
import { Semaphore } from "../concurrency.ts";
import { checkUsageLimits } from "../usage_limits.ts";
import { MaxRetriesError } from "../errors.ts";
import { applyHistoryProcessors } from "../history_processor.ts";
import { assertModelRequestsAllowed, _notifyModelRequest } from "../testing.ts";
import {
	isBinaryContent,
	isUploadedFile,
	binaryContentToToolResult,
	uploadedFileToToolResult,
} from "../binary_content.ts";

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
	/** Per-run model settings (overrides agent-level modelSettings). */
	modelSettings?: ModelSettings;
	/** Per-run end strategy (overrides agent-level endStrategy). */
	endStrategy?: EndStrategy;
	/** Populated by Agent.override(); replaces corresponding agent fields for this run. */
	_override?: {
		model?: LanguageModel;
		systemPrompts?: Array<string | ((ctx: RunContext<TDeps>) => string | Promise<string>)>;
		instructions?: Array<string | ((ctx: RunContext<TDeps>) => string | Promise<string>)>;
		tools?: ReadonlyArray<ToolDefinition<TDeps>>;
		toolsets?: ReadonlyArray<Toolset<TDeps>>;
		historyProcessors?: ReadonlyArray<HistoryProcessor<TDeps>>;
		resultValidators?: ReadonlyArray<ResultValidator<TDeps, TOutput>>;
		maxRetries?: number;
		maxTurns?: number;
		usageLimits?: UsageLimits;
		modelSettings?: ModelSettings;
		endStrategy?: EndStrategy;
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
	const toolResultMetadata = new Map<string, Record<string, unknown>>();
	return {
		deps,
		usage: createUsage(),
		retryCount: 0,
		toolName: null,
		runId: globalThis.crypto.randomUUID(),
		metadata,
		toolResultMetadata,
		attachMetadata(toolCallId: string, meta: Record<string, unknown>): void {
			toolResultMetadata.set(toolCallId, { ...meta });
		},
	};
}

async function resolvePromptParts<TDeps>(
	parts: ReadonlyArray<string | ((ctx: RunContext<TDeps>) => string | Promise<string>)>,
	ctx: RunContext<TDeps>,
): Promise<string | undefined> {
	const resolved: string[] = [];
	for (const p of parts) {
		resolved.push(typeof p === "string" ? p : await p(ctx));
	}
	return resolved.length > 0 ? resolved.join("\n\n") : undefined;
}

export async function resolveSystemPrompt<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	ctx: RunContext<TDeps>,
	overrideSystemPrompts?: Array<
		string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
	>,
): Promise<string | undefined> {
	const prompts = overrideSystemPrompts ?? [...agent.systemPrompts];
	return resolvePromptParts(prompts, ctx);
}

/**
 * Resolves instructions for the current turn and combines them with the
 * resolved system prompt. Instructions differ from systemPrompt in that they
 * are resolved per-turn (allowing dynamic per-turn values) and are NOT stored
 * in the message history (they only exist in the `system` field of each call).
 */
export async function resolveSystemWithInstructions<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	ctx: RunContext<TDeps>,
	systemPrompt: string | undefined,
	overrideInstructions?: Array<
		string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
	>,
): Promise<string | undefined> {
	const instructionParts = overrideInstructions ?? [...agent.instructions];
	const instructions = await resolvePromptParts(instructionParts, ctx);

	if (systemPrompt && instructions) {
		return `${systemPrompt}\n\n${instructions}`;
	}
	return systemPrompt ?? instructions;
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

/**
 * Build an AI SDK ToolSet from resolved tool definitions. Handles output tools
 * by wrapping their execute return to preserve the result, and handles
 * BinaryContent / UploadedFile returns by converting them to appropriate
 * AI SDK content parts.
 *
 * @param resolvedTools - Tool definitions resolved for this turn.
 * @param outputSchema - Optional Zod schema for the structured final_result tool.
 * @param ctx - The current RunContext.
 * @param maxConcurrency - Optional cap on concurrent tool executions.
 * @param sequentialMutex - Shared mutex for sequential tools.
 */
export function buildToolMap<TDeps>(
	resolvedTools: ToolDefinition<TDeps>[],
	outputSchema: import("zod").ZodTypeAny | undefined,
	ctx: RunContext<TDeps>,
	maxConcurrency?: number,
	sequentialMutex?: Semaphore,
): ToolSet {
	const toolMap = toAISDKTools(resolvedTools, () => ctx, maxConcurrency, sequentialMutex);
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
// Output tool detection
// ---------------------------------------------------------------------------

/**
 * Returns the name of the first output tool found in the resolved tools array,
 * or undefined if none exist.
 */
export function findOutputToolNames<TDeps>(
	resolvedTools: ToolDefinition<TDeps>[],
): Set<string> {
	const names = new Set<string>();
	for (const t of resolvedTools) {
		if (t.isOutput) names.add(t.name);
	}
	return names;
}

// ---------------------------------------------------------------------------
// BinaryContent / UploadedFile tool result conversion
// ---------------------------------------------------------------------------

/**
 * Serialize a tool execute return value to a form the AI SDK will accept in
 * a tool-result message. BinaryContent becomes a base64 data-URI string;
 * UploadedFile becomes a file-reference string; everything else passes through.
 */
export function serializeToolResult(value: unknown): unknown {
	if (isBinaryContent(value)) {
		return binaryContentToToolResult(value);
	}
	if (isUploadedFile(value)) {
		return uploadedFileToToolResult(value);
	}
	return value;
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
	/** System prompt combined with per-turn instructions. */
	system: string | undefined;
	/** Names of output tools resolved for this turn. */
	outputToolNames: Set<string>;
	/** Resolved tool definitions (used for output tool detection). */
	resolvedTools: ToolDefinition<TDeps>[];
}

export async function prepareTurn<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	opts: InternalRunOpts<TDeps, TOutput>,
	ctx: RunContext<TDeps>,
	messages: ModelMessage[],
	/** The resolved system prompt (without instructions) from run start. */
	systemPrompt: string | undefined,
	/** Shared mutex for sequential tools (created once per run). */
	sequentialMutex?: Semaphore,
): Promise<TurnSetup<TDeps>> {
	// Check usage limits (agent-level, then per-run override)
	const limits = opts._override?.usageLimits ?? opts.usageLimits ?? agent.usageLimits;
	if (limits) checkUsageLimits(limits, ctx.usage);

	const tools = opts._override?.tools ?? agent.tools;
	const toolsets = opts._override?.toolsets ?? agent.toolsets;
	const resolvedTools = await resolveTools(tools, toolsets, ctx);
	const outputToolNames = findOutputToolNames(resolvedTools);
	const toolMap = buildToolMap(
		resolvedTools,
		agent.outputSchema,
		ctx,
		agent.maxConcurrency,
		sequentialMutex,
	);

	const historyProcessors = opts._override?.historyProcessors ?? agent.historyProcessors;
	const msgsForModel = await applyHistoryProcessors(historyProcessors, messages, ctx);

	// Resolve per-turn instructions and combine with system prompt
	const system = await resolveSystemWithInstructions(
		agent,
		ctx,
		systemPrompt,
		opts._override?.instructions,
	);

	// Notify capture store
	_notifyModelRequest(msgsForModel);

	return { toolMap, tools: toolsOrUndefined(toolMap), msgsForModel, system, outputToolNames, resolvedTools };
}

/** Resolve effective model settings, merging agent-level with run/override-level. */
export function resolveModelSettings<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	opts: InternalRunOpts<TDeps, TOutput>,
): ModelSettings {
	// Override-level > run-level > agent-level (spread, so later keys win)
	return {
		...(agent.modelSettings ?? {}),
		...(opts.modelSettings ?? {}),
		...(opts._override?.modelSettings ?? {}),
	};
}

/**
 * Convert a `ModelSettings` object to the options expected by AI SDK v6's
 * `generateText` / `streamText`. Notably, `maxTokens` maps to `maxOutputTokens`.
 */
export function modelSettingsToAISDKOptions(settings: ModelSettings): Record<string, unknown> {
	const {
		maxTokens,
		temperature,
		topP,
		topK,
		frequencyPenalty,
		presencePenalty,
		stopSequences,
		seed,
	} = settings;
	const result: Record<string, unknown> = {};
	if (temperature !== undefined) result.temperature = temperature;
	if (maxTokens !== undefined) result.maxOutputTokens = maxTokens;
	if (topP !== undefined) result.topP = topP;
	if (topK !== undefined) result.topK = topK;
	if (frequencyPenalty !== undefined) result.frequencyPenalty = frequencyPenalty;
	if (presencePenalty !== undefined) result.presencePenalty = presencePenalty;
	if (stopSequences !== undefined) result.stopSequences = stopSequences;
	if (seed !== undefined) result.seed = seed;
	return result;
}

/** Resolve effective end strategy. */
export function resolveEndStrategy<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	opts: InternalRunOpts<TDeps, TOutput>,
): import("../agent.ts").EndStrategy {
	return opts._override?.endStrategy ?? opts.endStrategy ?? agent.endStrategy;
}

// ---------------------------------------------------------------------------
// Sequential mutex factory
// ---------------------------------------------------------------------------

/**
 * Create a shared mutex (1-permit Semaphore) for sequential tool execution.
 * Used once per run and shared across all turns.
 */
export function createSequentialMutex(): Semaphore {
	return new Semaphore(1);
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
