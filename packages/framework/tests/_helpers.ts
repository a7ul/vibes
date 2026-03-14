import {
	MockLanguageModelV3,
	mockValues,
	convertArrayToReadableStream,
} from "ai/test";

export type DoGenerateResult = Awaited<
	ReturnType<MockLanguageModelV3["doGenerate"]>
>;
export type DoStreamResult = Awaited<
	ReturnType<MockLanguageModelV3["doStream"]>
>;

export { MockLanguageModelV3, mockValues, convertArrayToReadableStream };

export function makeUsage() {
	return {
		inputTokens: {
			total: 10,
			noCache: 10,
			cacheRead: 0,
			cacheWrite: undefined,
		},
		outputTokens: { total: 5, text: undefined, reasoning: undefined },
	};
}

export function textResponse(text: string): DoGenerateResult {
	return {
		content: [{ type: "text", text }],
		finishReason: { unified: "stop" as const, raw: undefined },
		usage: makeUsage(),
		warnings: [],
	};
}

export function toolCallResponse(
	toolName: string,
	input: unknown,
	toolCallId = "tc1",
): DoGenerateResult {
	return {
		content: [
			{ type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) },
		],
		finishReason: { unified: "tool-calls" as const, raw: undefined },
		usage: makeUsage(),
		warnings: [],
	};
}

export function textStream(text: string): DoStreamResult {
	return {
		stream: convertArrayToReadableStream([
			{ type: "text-delta" as const, id: "text-1", delta: text },
			{
				type: "finish" as const,
				finishReason: { unified: "stop" as const, raw: undefined },
				usage: makeUsage(),
			},
		]),
	};
}

export function toolCallStream(
	toolName: string,
	input: unknown,
	toolCallId = "tc1",
): DoStreamResult {
	return {
		stream: convertArrayToReadableStream([
			{
				type: "tool-call" as const,
				toolCallId,
				toolName,
				input: JSON.stringify(input),
			},
			{
				type: "finish" as const,
				finishReason: { unified: "tool-calls" as const, raw: undefined },
				usage: makeUsage(),
			},
		]),
	};
}
