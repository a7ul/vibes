import { assertEquals } from "@std/assert";
import { summarizeHistoryProcessor } from "../mod.ts";
import type { ModelMessage } from "ai";
import {
	MockLanguageModelV3,
	textResponse,
} from "./_helpers.ts";

function userMsg(text: string): ModelMessage {
	return { role: "user", content: text };
}

function assistantMsg(text: string): ModelMessage {
	return { role: "assistant", content: text };
}

function systemMsg(text: string): ModelMessage {
	return { role: "system", content: text };
}

/** Build a message history with `count` alternating user/assistant pairs. */
function buildHistory(count: number): ModelMessage[] {
	const msgs: ModelMessage[] = [];
	for (let i = 0; i < count; i++) {
		msgs.push(userMsg(`user-${i}`), assistantMsg(`assistant-${i}`));
	}
	return msgs;
}

Deno.test("summarizeHistoryProcessor - no-op when history is within limit", async () => {
	const model = new MockLanguageModelV3({ doGenerate: textResponse("summary") });
	const processor = summarizeHistoryProcessor(model, { maxMessages: 20 });

	// 10 messages — well under the 20-message limit
	const messages = buildHistory(5);
	const result = await processor(messages, {} as never);

	// Should be returned unchanged (model never called)
	assertEquals(result, messages);
});

Deno.test("summarizeHistoryProcessor - triggers when history exceeds maxMessages", async () => {
	let summarizeCalled = false;
	const model = new MockLanguageModelV3({
		doGenerate: () => {
			summarizeCalled = true;
			return Promise.resolve(textResponse("This is the summary."));
		},
	});

	// 22 messages > default 20
	const processor = summarizeHistoryProcessor(model, { maxMessages: 20 });
	const messages = buildHistory(11); // 22 messages
	await processor(messages, {} as never);

	assertEquals(summarizeCalled, true);
});

Deno.test("summarizeHistoryProcessor - result contains summary message + recent messages", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(textResponse("SUMMARY_TEXT")),
	});

	// maxMessages = 4, keepRecent = floor(4/2) = 2
	const processor = summarizeHistoryProcessor(model, { maxMessages: 4 });

	// 6 non-system messages > 4
	const messages = [
		userMsg("msg0"),
		assistantMsg("msg1"),
		userMsg("msg2"),
		assistantMsg("msg3"),
		userMsg("msg4"), // kept (recent 2)
		assistantMsg("msg5"), // kept (recent 2)
	];

	const result = await processor(messages, {} as never);

	// Result: [summary message, msg4, msg5]
	assertEquals(result.length, 3);
	const summaryMsg = result[0];
	assertEquals(summaryMsg.role, "user");
	assertEquals(
		typeof summaryMsg.content === "string" &&
			summaryMsg.content.includes("SUMMARY_TEXT"),
		true,
	);
	assertEquals(result[1], userMsg("msg4"));
	assertEquals(result[2], assistantMsg("msg5"));
});

Deno.test("summarizeHistoryProcessor - system messages are always preserved", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(textResponse("summary")),
	});

	// maxMessages = 4
	const processor = summarizeHistoryProcessor(model, { maxMessages: 4 });

	const messages: ModelMessage[] = [
		systemMsg("system prompt"),
		userMsg("msg0"),
		assistantMsg("msg1"),
		userMsg("msg2"),
		assistantMsg("msg3"),
		userMsg("msg4"), // recent
	];

	const result = await processor(messages, {} as never);

	// First element must be the system message
	assertEquals(result[0].role, "system");
	assertEquals(result[0].content, "system prompt");
});

Deno.test("summarizeHistoryProcessor - uses custom summarizePrompt", async () => {
	let capturedPrompt = "";
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			const firstMsg = opts.prompt[0];
			if (
				firstMsg &&
				firstMsg.role === "user" &&
				typeof firstMsg.content === "string"
			) {
				capturedPrompt = firstMsg.content;
			} else if (
				firstMsg &&
				firstMsg.role === "user" &&
				Array.isArray(firstMsg.content) &&
				firstMsg.content[0] &&
				typeof firstMsg.content[0] === "object" &&
				"text" in firstMsg.content[0]
			) {
				capturedPrompt = (firstMsg.content[0] as { type: string; text: string }).text;
			}
			return Promise.resolve(textResponse("done"));
		},
	});

	const customPrompt = "CUSTOM_PROMPT:";
	const processor = summarizeHistoryProcessor(model, {
		maxMessages: 4,
		summarizePrompt: customPrompt,
	});

	const messages = buildHistory(5); // 10 messages > 4
	await processor(messages, {} as never);

	assertEquals(capturedPrompt.startsWith(customPrompt), true);
});

Deno.test("summarizeHistoryProcessor - does not mutate input messages", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(textResponse("summary")),
	});

	const processor = summarizeHistoryProcessor(model, { maxMessages: 4 });
	const messages = buildHistory(5); // 10 messages
	const snapshot = [...messages];

	await processor(messages, {} as never);

	assertEquals(messages, snapshot);
});
