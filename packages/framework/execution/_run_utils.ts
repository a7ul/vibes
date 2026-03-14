/**
 * Internal helpers shared between run.ts (non-streaming) and stream.ts (streaming).
 * Not part of the public API.
 */
import {
	tool as aiTool,
	type LanguageModelUsage,
	type ModelMessage,
	type ToolSet,
} from "ai";
import type { Agent } from "../agent.ts";
import type { ResultValidator, RunContext, Usage } from "../types.ts";
import { createUsage } from "../types.ts";
import { toAISDKTools } from "../tool.ts";
import { MaxRetriesError } from "../errors.ts";

// ---------------------------------------------------------------------------
// Context / message helpers
// ---------------------------------------------------------------------------

export function createRunContext<TDeps>(deps: TDeps): RunContext<TDeps> {
	return {
		deps,
		usage: createUsage(),
		retryCount: 0,
		toolName: null,
		runId: globalThis.crypto.randomUUID(),
	};
}

export async function resolveSystemPrompt<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	ctx: RunContext<TDeps>,
): Promise<string | undefined> {
	const parts: string[] = [];
	for (const p of agent.systemPrompts) {
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
// Tool map builder — call once per run, not per turn
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

export function buildToolMap<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	ctx: RunContext<TDeps>,
): ToolSet {
	const toolMap = toAISDKTools(agent.tools, () => ctx);
	if (agent.outputSchema) {
		toolMap[FINAL_RESULT_TOOL] = aiTool({
			description: "Return the final structured result.",
			inputSchema: agent.outputSchema,
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
