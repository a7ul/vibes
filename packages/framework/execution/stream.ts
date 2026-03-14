import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { RunContext, StreamResult, Usage } from "../types.ts";
import {
	applyUsage,
	buildInitialMessages,
	buildResponseMessages,
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

// ---------------------------------------------------------------------------
// Deferred result — single promise resolves output + messages + usage together
// ---------------------------------------------------------------------------

interface DeferredResult<TOutput> {
	promise: Promise<{
		output: TOutput;
		messages: ModelMessage[];
		newMessages: ModelMessage[];
		usage: Usage;
	}>;
	resolve: (v: {
		output: TOutput;
		messages: ModelMessage[];
		newMessages: ModelMessage[];
		usage: Usage;
	}) => void;
	reject: (e: unknown) => void;
}

function createDeferred<TOutput>(): DeferredResult<TOutput> {
	let resolve!: DeferredResult<TOutput>["resolve"];
	let reject!: DeferredResult<TOutput>["reject"];
	const promise = new Promise<{
		output: TOutput;
		messages: ModelMessage[];
		newMessages: ModelMessage[];
		usage: Usage;
	}>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// ReadableStream → AsyncIterable bridge
// ---------------------------------------------------------------------------

async function* readableToAsyncIterable(
	stream: ReadableStream<string>,
): AsyncGenerator<string> {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

// ---------------------------------------------------------------------------
// Main streaming entry point
// ---------------------------------------------------------------------------

export function executeStream<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	prompt: string,
	opts: InternalRunOpts<TDeps, TOutput>,
): StreamResult<TOutput> {
	checkModelRequestsAllowed(opts._bypassModelRequestsCheck);

	const deferred = createDeferred<TOutput>();

	let textController!: ReadableStreamDefaultController<string>;
	const textReadable = new ReadableStream<string>({
		start: (c) => {
			textController = c;
		},
	});

	runStreamLoop(agent, prompt, opts, textController, deferred);

	return {
		textStream: readableToAsyncIterable(textReadable),
		output: deferred.promise.then((r) => r.output),
		messages: deferred.promise.then((r) => r.messages),
		newMessages: deferred.promise.then((r) => r.newMessages),
		usage: deferred.promise.then((r) => r.usage),
	};
}

// ---------------------------------------------------------------------------
// Background loop
// ---------------------------------------------------------------------------

async function runStreamLoop<TDeps, TOutput>(
	agent: Agent<TDeps, TOutput>,
	prompt: string,
	opts: InternalRunOpts<TDeps, TOutput>,
	textController: ReadableStreamDefaultController<string>,
	deferred: DeferredResult<TOutput>,
): Promise<void> {
	const ctx: RunContext<TDeps> = createRunContext(
		opts.deps,
		opts.metadata ?? {},
	);
	const { usage } = ctx;
	let streamClosed = false;

	const model = opts._override?.model ?? agent.model;
	const maxTurns = opts._override?.maxTurns ?? agent.maxTurns;
	const maxRetries = opts._override?.maxRetries ?? agent.maxRetries;
	const resultValidators = opts._override?.resultValidators ?? agent.resultValidators;
	const modelSettingsRaw = resolveModelSettings(agent, opts);
	const modelSettings = modelSettingsToAISDKOptions(modelSettingsRaw);
	const endStrategy = resolveEndStrategy(agent, opts);

	// systemPrompt resolved once; instructions resolved per-turn inside prepareTurn
	const systemPrompt = await resolveSystemPrompt(
		agent,
		ctx,
		opts._override?.systemPrompts,
	);

	const inputOffset = opts.messageHistory?.length ?? 0;
	const messages = buildInitialMessages(opts.messageHistory, prompt);

	try {
		for (let turn = 0; turn < maxTurns; turn++) {
			const { tools, msgsForModel, system } = await prepareTurn(
				agent,
				opts,
				ctx,
				messages,
				systemPrompt,
			);

			const stream = streamText({
				model,
				system,
				messages: msgsForModel,
				tools,
				stopWhen: stepCountIs(1),
				...modelSettings,
			});

			let accumulatedText = "";
			for await (const delta of stream.textStream) {
				accumulatedText += delta;
				textController.enqueue(delta);
			}

			const [streamUsage, toolCalls, toolResults, responseData] =
				await Promise.all([
					stream.usage,
					stream.toolCalls,
					stream.toolResults,
					stream.response,
				]);

			applyUsage(usage, streamUsage);

			const newMessages = buildResponseMessages(
				(responseData.messages ?? []) as ModelMessage[],
				accumulatedText,
			);

			// Check for final_result tool result
			const finalResult = toolResults.find(
				(r) => r.toolName === FINAL_RESULT_TOOL,
			);
			if (finalResult && agent.outputSchema) {
				const parsed = agent.outputSchema.safeParse(finalResult.input);
				if (!parsed.success) {
					messages.push(...newMessages);
					nudgeWithValidationError(
						ctx,
						messages,
						maxRetries,
						parsed.error,
					);
					continue;
				}
				try {
					const output = await runValidators(
						resultValidators,
						ctx,
						parsed.data as TOutput,
					);

					// With 'exhaustive' strategy, ensure all other tool results in this
					// response have been awaited before resolving. streamText with
					// stepCountIs(1) already awaits all tool executions, so by the time
					// `toolResults` resolves, all tools have run. The strategy is stored
					// for callers.
					void endStrategy; // acknowledged

					const allMessages = [...messages, ...newMessages];
					streamClosed = true;
					textController.close();
					deferred.resolve({
						output,
						messages: allMessages,
						newMessages: allMessages.slice(inputOffset),
						usage: { ...usage },
					});
					return;
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					messages.push(...newMessages);
					nudgeWithValidationError(ctx, messages, maxRetries, error);
					continue;
				}
			}

			// No tool calls — text response
			if (toolCalls.length === 0) {
				if (agent.outputSchema) {
					messages.push(...newMessages);
					nudgeForFinalResult(ctx, messages, maxRetries);
					continue;
				}
				const allMessages = [...messages, ...newMessages];
				streamClosed = true;
				textController.close();
				deferred.resolve({
					output: accumulatedText as TOutput,
					messages: allMessages,
					newMessages: allMessages.slice(inputOffset),
					usage: { ...usage },
				});
				return;
			}

			// Other tool calls — continue loop
			messages.push(...newMessages);
		}

		throw new MaxTurnsError(maxTurns);
	} catch (err) {
		if (!streamClosed) {
			textController.close();
		}
		deferred.reject(err);
	}
}
