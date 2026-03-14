import { generateText, stepCountIs, Output as aiOutput } from "ai";
import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { RunContext, RunResult } from "../types.ts";
import {
	applyUsage,
	buildInitialMessages,
	buildResumeToolMessage,
	correlateApprovalIds,
	createRunContext,
	createSequentialMutex,
	isFinalResultTool,
	unionToolIndex,
	normaliseSchemas,
	nudgeForFinalResult,
	nudgeWithValidationError,
	prepareTurn,
	resolveSystemPrompt,
	resolveModelSettings,
	modelSettingsToAISDKOptions,
	resolveEndStrategy,
	resolveTelemetry,
	resolveTools,
	buildDeferredAwareToolMap,
	toolsOrUndefined,
	stripDeferredToolResults,
	runValidators,
	checkModelRequestsAllowed,
	parseTextOutput,
	DeferredToolRequests,
	type InternalRunOpts,
} from "./_run_utils.ts";
import { MaxTurnsError, ApprovalRequiredError } from "../errors.ts";

export async function executeRun<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	prompt: string,
	opts: InternalRunOpts<TDeps, TOutput>,
): Promise<RunResult<TOutput>> {
	checkModelRequestsAllowed(opts._bypassModelRequestsCheck);

	const ctx: RunContext<TDeps> = createRunContext(
		opts.deps,
		opts.metadata ?? {},
	);
	const { usage, runId } = ctx;

	const model = opts._override?.model ?? agent.model;
	const maxTurns = opts._override?.maxTurns ?? agent.maxTurns;
	const maxRetries = opts._override?.maxRetries ?? agent.maxRetries;
	const resultValidators = opts._override?.resultValidators ?? agent.resultValidators;
	const modelSettingsRaw = resolveModelSettings(agent, opts);
	const modelSettings = modelSettingsToAISDKOptions(modelSettingsRaw);
	const endStrategy = resolveEndStrategy(agent, opts);
	const telemetry = resolveTelemetry(agent, opts);
	const outputMode = agent.outputMode;
	const outputSchema = agent.outputSchema;
	const schemas = normaliseSchemas(outputSchema);

	// systemPrompt is resolved once; instructions are resolved per-turn inside prepareTurn
	const systemPrompt = await resolveSystemPrompt(
		agent,
		ctx,
		opts._override?.systemPrompts,
	);

	// Shared mutex for sequential tools — created once per run
	const sequentialMutex = createSequentialMutex();

	// When resuming from deferred results, the messageHistory already contains
	// the full conversation (including the assistant's tool call message).
	// In that case, don't add the prompt as a new user message.
	const inputOffset = opts.messageHistory?.length ?? 0;
	let messages: ModelMessage[];
	if (opts._resumeFromDeferred && opts.messageHistory) {
		messages = [...opts.messageHistory];
	} else {
		messages = buildInitialMessages(opts.messageHistory, prompt);
	}

	// ---------------------------------------------------------------------------
	// Resume from deferred tool results (human-in-the-loop continuation)
	// ---------------------------------------------------------------------------
	if (opts.deferredResults) {
		const dr = opts.deferredResults;
		// Reconstruct the tools for resume so we can re-execute with argsOverride
		const toolDefs = opts._override?.tools ?? agent.tools;
		const toolsetDefs = opts._override?.toolsets ?? agent.toolsets;
		const resolvedForResume = await resolveTools(toolDefs, toolsetDefs, ctx);
		// Use the original pending requests (with real toolNames) if available,
		// falling back to placeholders keyed by toolCallId.
		const pendingRequests = opts._deferredPendingRequests
			?? dr.results.map((r) => ({ toolCallId: r.toolCallId, toolName: r.toolCallId, args: {} }));
		const resumeMsg = await buildResumeToolMessage(dr, pendingRequests, resolvedForResume, ctx);
		messages = [...messages, resumeMsg];
	}

	for (let turn = 0; turn < maxTurns; turn++) {
		// ---------------------------------------------------------------------------
		// Pre-turn setup: resolve tools, apply history processors, build system prompt
		// ---------------------------------------------------------------------------
		const turnSetup = await prepareTurn(
			agent,
			opts,
			ctx,
			messages,
			systemPrompt,
			sequentialMutex,
		);
		const { msgsForModel, system, outputToolNames, resolvedTools } = turnSetup;

		// Check if any resolved tools require approval — if so, build a deferred-aware map
		const pendingApprovals: import("../deferred.ts").DeferredToolRequest[] = [];
		const hasApprovalTools = resolvedTools.some(
			(t) => t.requiresApproval !== undefined && t.requiresApproval !== false,
		);

		let effectiveTools: ReturnType<typeof toolsOrUndefined>;
		if (hasApprovalTools) {
			const deferredMap = buildDeferredAwareToolMap(
				resolvedTools,
				agent.outputSchema,
				agent.outputMode,
				ctx,
				pendingApprovals,
				agent.maxConcurrency,
				sequentialMutex,
			);
			effectiveTools = toolsOrUndefined(deferredMap);
		} else {
			effectiveTools = turnSetup.tools;
		}

		// ---------------------------------------------------------------------------
		// Native structured output mode — use AI SDK's output.object()
		// ---------------------------------------------------------------------------
		if (outputMode === "native" && schemas.length > 0) {
			const primarySchema = schemas[0];
			const rawResponse = await (generateText as unknown as (opts: Record<string, unknown>) => Promise<Record<string, unknown>>)({
				model,
				system,
				messages: msgsForModel,
				tools: effectiveTools,
				stopWhen: stepCountIs(1),
				output: aiOutput.object({ schema: primarySchema }),
				...(telemetry !== undefined ? { experimental_telemetry: telemetry } : {}),
				...modelSettings,
			});

			// Check for pending approvals before processing results
			if (pendingApprovals.length > 0) {
				const rawToolCalls = rawResponse["toolCalls"] as Array<{ toolCallId: string; toolName: string }> | undefined;
				correlateApprovalIds(pendingApprovals, rawToolCalls ?? []);
				const pendingCallIds = pendingApprovals.map((r) => r.toolCallId);
				const rawNewMessages = ((rawResponse["response"] as Record<string, unknown>)?.["messages"] ?? []) as ModelMessage[];
				// Strip placeholder tool results for deferred calls from the resume state
				const cleanNewMessages = stripDeferredToolResults(rawNewMessages, pendingCallIds);
				const allMessages = [...messages, ...cleanNewMessages];
				throw new ApprovalRequiredError(
					new DeferredToolRequests(pendingApprovals, { messages: allMessages, turnCount: turn + 1 }),
				);
			}

			applyUsage(usage, rawResponse["usage"] as import("ai").LanguageModelUsage);

			const nativeResponseObj = rawResponse["response"] as { messages?: ModelMessage[] } | undefined;
			const newMessages = (nativeResponseObj?.messages ?? []) as ModelMessage[];

			// Check for output tool result (user-defined tools that end the run)
			const nativeToolResults = rawResponse["toolResults"] as Array<{ toolName: string; output: unknown }> | undefined;
			const outputResult = (nativeToolResults ?? []).find(
				(r) => outputToolNames.has(r.toolName),
			);
			if (outputResult) {
				const rawOutput = outputResult.output as TOutput;
				try {
					const validatedOutput = await runValidators(resultValidators, ctx, rawOutput);
					void endStrategy;
					const allMessages = [...messages, ...newMessages];
					return {
						output: validatedOutput,
						messages: allMessages,
						newMessages: allMessages.slice(inputOffset),
						usage: { ...usage },
						retryCount: ctx.retryCount,
						runId,
						toolMetadata: new Map(ctx.toolResultMetadata),
					};
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					messages.push(...newMessages);
					nudgeWithValidationError(ctx, messages, maxRetries, error);
					continue;
				}
			}

			// Native mode: model's parsed output is in response.output
			const nativeOutput = rawResponse["output"];
			if (nativeOutput !== undefined && nativeOutput !== null) {
				const parsed = primarySchema.safeParse(nativeOutput);
				if (!parsed.success) {
					messages.push(...newMessages);
					nudgeWithValidationError(ctx, messages, maxRetries, parsed.error);
					continue;
				}
				try {
					const validatedOutput = await runValidators(resultValidators, ctx, parsed.data as TOutput);
					void endStrategy;
					const allMessages = [...messages, ...newMessages];
					return {
						output: validatedOutput,
						messages: allMessages,
						newMessages: allMessages.slice(inputOffset),
						usage: { ...usage },
						retryCount: ctx.retryCount,
						runId,
						toolMetadata: new Map(ctx.toolResultMetadata),
					};
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					messages.push(...newMessages);
					nudgeWithValidationError(ctx, messages, maxRetries, error);
					continue;
				}
			}

			// Native mode with no object yet — nudge
			messages.push(...newMessages);
			nudgeForFinalResult(ctx, messages, maxRetries);
			continue;
		}

		// ---------------------------------------------------------------------------
		// Prompted output mode — schema injected into system prompt, parse text
		// ---------------------------------------------------------------------------
		if (outputMode === "prompted" && schemas.length > 0) {
			const response = await generateText({
				model,
				system,
				messages: msgsForModel,
				tools: effectiveTools,
				stopWhen: stepCountIs(1),
				...(telemetry !== undefined ? { experimental_telemetry: telemetry } : {}),
				...modelSettings,
			});

			// Check for pending approvals
			if (pendingApprovals.length > 0) {
				correlateApprovalIds(pendingApprovals, response.toolCalls);
				const pendingCallIds = pendingApprovals.map((r) => r.toolCallId);
				const rawNewMessages = response.response.messages as ModelMessage[];
				const cleanNewMessages = stripDeferredToolResults(rawNewMessages, pendingCallIds);
				const allMessages = [...messages, ...cleanNewMessages];
				throw new ApprovalRequiredError(
					new DeferredToolRequests(pendingApprovals, { messages: allMessages, turnCount: turn + 1 }),
				);
			}

			applyUsage(usage, response.usage);
			const newMessages = response.response.messages as ModelMessage[];

			// Check for output tool result (user-defined tools that end the run)
			const outputResult = response.toolResults.find(
				(r) => outputToolNames.has(r.toolName),
			);
			if (outputResult) {
				const rawOutput = (outputResult as unknown as { output: unknown }).output as TOutput;
				try {
					const validatedOutput = await runValidators(resultValidators, ctx, rawOutput);
					void endStrategy;
					const allMessages = [...messages, ...newMessages];
					return {
						output: validatedOutput,
						messages: allMessages,
						newMessages: allMessages.slice(inputOffset),
						usage: { ...usage },
						retryCount: ctx.retryCount,
						runId,
						toolMetadata: new Map(ctx.toolResultMetadata),
					};
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					messages.push(...newMessages);
					nudgeWithValidationError(ctx, messages, maxRetries, error);
					continue;
				}
			}

			// Prompted mode: parse model's text response as JSON
			if (response.text.trim().length > 0) {
				const parseResult = parseTextOutput<TOutput>(response.text, outputSchema);
				if (!parseResult.success) {
					messages.push(...newMessages);
					nudgeWithValidationError(ctx, messages, maxRetries, parseResult.error);
					continue;
				}
				try {
					const validatedOutput = await runValidators(resultValidators, ctx, parseResult.data);
					void endStrategy;
					const allMessages = [...messages, ...newMessages];
					return {
						output: validatedOutput,
						messages: allMessages,
						newMessages: allMessages.slice(inputOffset),
						usage: { ...usage },
						retryCount: ctx.retryCount,
						runId,
						toolMetadata: new Map(ctx.toolResultMetadata),
					};
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					messages.push(...newMessages);
					nudgeWithValidationError(ctx, messages, maxRetries, error);
					continue;
				}
			}

			// No text — nudge
			messages.push(...newMessages);
			nudgeForFinalResult(ctx, messages, maxRetries);
			continue;
		}

		// ---------------------------------------------------------------------------
		// Tool output mode (default)
		// ---------------------------------------------------------------------------
		const response = await generateText({
			model,
			system,
			messages: msgsForModel,
			tools: effectiveTools,
			stopWhen: stepCountIs(1),
			...(telemetry !== undefined ? { experimental_telemetry: telemetry } : {}),
			...modelSettings,
		});

		// Check for pending approvals before processing results
		if (pendingApprovals.length > 0) {
			correlateApprovalIds(pendingApprovals, response.toolCalls);
			const pendingCallIds = pendingApprovals.map((r) => r.toolCallId);
			const rawNewMessages = response.response.messages as ModelMessage[];
			const cleanNewMessages = stripDeferredToolResults(rawNewMessages, pendingCallIds);
			const allMessages = [...messages, ...cleanNewMessages];
			throw new ApprovalRequiredError(
				new DeferredToolRequests(pendingApprovals, { messages: allMessages, turnCount: turn + 1 }),
			);
		}

		applyUsage(usage, response.usage);

		const newMessages = response.response.messages as ModelMessage[];

		// Check for output tool result (user-defined tools that end the run)
		const outputResult = response.toolResults.find(
			(r) => outputToolNames.has(r.toolName),
		);
		if (outputResult) {
			const rawOutput = (outputResult as unknown as { output: unknown }).output as TOutput;
			try {
				const validatedOutput = await runValidators(
					resultValidators,
					ctx,
					rawOutput,
				);
				void endStrategy;
				const allMessages = [...messages, ...newMessages];
				return {
					output: validatedOutput,
					messages: allMessages,
					newMessages: allMessages.slice(inputOffset),
					usage: { ...usage },
					retryCount: ctx.retryCount,
					runId,
					toolMetadata: new Map(ctx.toolResultMetadata),
				};
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				messages.push(...newMessages);
				nudgeWithValidationError(ctx, messages, maxRetries, error);
				continue;
			}
		}

		// Check for final_result (or final_result_N) tool result
		const finalResultEntry = response.toolResults.find(
			(r) => isFinalResultTool(r.toolName),
		);
		if (finalResultEntry && schemas.length > 0) {
			// Determine which schema to parse with (union: look at tool name index)
			const idx = unionToolIndex(finalResultEntry.toolName) ?? 0;
			const schema = schemas[idx] ?? schemas[0];
			const parsed = schema.safeParse(finalResultEntry.input);
			if (!parsed.success) {
				messages.push(...newMessages);
				nudgeWithValidationError(ctx, messages, maxRetries, parsed.error);
				continue;
			}
			try {
				const validatedOutput = await runValidators(
					resultValidators,
					ctx,
					parsed.data as TOutput,
				);

				// generateText resolves all tool calls before returning, so all side
				// effects have run regardless of endStrategy. The strategy is stored on
				// the result for callers that need to inspect it.
				void endStrategy; // acknowledged — no extra action needed in non-streaming path

				const allMessages = [...messages, ...newMessages];
				return {
					output: validatedOutput,
					messages: allMessages,
					newMessages: allMessages.slice(inputOffset),
					usage: { ...usage },
					retryCount: ctx.retryCount,
					runId,
					toolMetadata: new Map(ctx.toolResultMetadata),
				};
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				messages.push(...newMessages);
				nudgeWithValidationError(ctx, messages, maxRetries, error);
				continue;
			}
		}

		// No tool calls — text response
		if (response.toolCalls.length === 0) {
			if (schemas.length > 0) {
				messages.push(...newMessages);
				nudgeForFinalResult(ctx, messages, maxRetries);
				continue;
			}
			const allMessages = [...messages, ...newMessages];
			return {
				output: response.text as TOutput,
				messages: allMessages,
				newMessages: allMessages.slice(inputOffset),
				usage: { ...usage },
				retryCount: ctx.retryCount,
				runId,
				toolMetadata: new Map(ctx.toolResultMetadata),
			};
		}

		// Other tool calls — continue loop
		messages.push(...newMessages);
	}

	throw new MaxTurnsError(maxTurns);
}
