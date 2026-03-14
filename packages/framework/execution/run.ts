import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { RunContext, RunResult } from "../types.ts";
import {
	applyUsage,
	buildInitialMessages,
	createRunContext,
	FINAL_RESULT_TOOL,
	nudgeForFinalResult,
	nudgeWithValidationError,
	prepareTurn,
	resolveSystemPrompt,
	resolveModelSettings,
	modelSettingsToAISDKOptions,
	resolveEndStrategy,
	runValidators,
	checkModelRequestsAllowed,
	type InternalRunOpts,
} from "./_run_utils.ts";
import { MaxTurnsError } from "../errors.ts";

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

	// systemPrompt is resolved once; instructions are resolved per-turn inside prepareTurn
	const systemPrompt = await resolveSystemPrompt(
		agent,
		ctx,
		opts._override?.systemPrompts,
	);

	const inputOffset = opts.messageHistory?.length ?? 0;
	const messages = buildInitialMessages(opts.messageHistory, prompt);

	for (let turn = 0; turn < maxTurns; turn++) {
		const { tools, msgsForModel, system } = await prepareTurn(
			agent,
			opts,
			ctx,
			messages,
			systemPrompt,
		);

		const response = await generateText({
			model,
			system,
			messages: msgsForModel,
			tools,
			stopWhen: stepCountIs(1),
			...modelSettings,
		});

		applyUsage(usage, response.usage);

		const newMessages = response.response.messages as ModelMessage[];

		// Check for final_result tool result
		const finalResult = response.toolResults.find(
			(r) => r.toolName === FINAL_RESULT_TOOL,
		);
		if (finalResult && agent.outputSchema) {
			const parsed = agent.outputSchema.safeParse(finalResult.input);
			if (!parsed.success) {
				messages.push(...newMessages);
				nudgeWithValidationError(ctx, messages, maxRetries, parsed.error);
				continue;
			}
			try {
				const output = await runValidators(
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
					output,
					messages: allMessages,
					newMessages: allMessages.slice(inputOffset),
					usage: { ...usage },
					retryCount: ctx.retryCount,
					runId,
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
			if (agent.outputSchema) {
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
			};
		}

		// Other tool calls — continue loop
		messages.push(...newMessages);
	}

	throw new MaxTurnsError(maxTurns);
}
