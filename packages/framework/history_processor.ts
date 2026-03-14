import type { ModelMessage } from "ai";
import type { RunContext } from "./types.ts";

/**
 * A function that transforms the message history before each model call.
 * Processors are applied in order. They receive the accumulated messages
 * and the current run context, and return a (possibly shorter/modified) list
 * of messages to actually send to the model.
 *
 * Processors do NOT mutate the stored history — they only affect what's
 * sent to the model on that turn.
 */
export type HistoryProcessor<TDeps = undefined> = (
	messages: ModelMessage[],
	ctx: RunContext<TDeps>,
) => ModelMessage[] | Promise<ModelMessage[]>;

/**
 * Keeps only the last `n` messages in the history sent to the model.
 * Useful for long-running conversations where old context is not needed.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   model,
 *   historyProcessors: [trimHistoryProcessor(20)],
 * });
 * ```
 */
export function trimHistoryProcessor(maxMessages: number): HistoryProcessor {
	return (messages) => {
		if (messages.length <= maxMessages) return messages;
		return messages.slice(-maxMessages);
	};
}

/**
 * Applies a chain of history processors to the given message list.
 * @internal
 */
export async function applyHistoryProcessors<TDeps>(
	processors: ReadonlyArray<HistoryProcessor<TDeps>>,
	messages: ModelMessage[],
	ctx: RunContext<TDeps>,
): Promise<ModelMessage[]> {
	let result = messages;
	for (const processor of processors) {
		result = await processor(result, ctx);
	}
	return result;
}
