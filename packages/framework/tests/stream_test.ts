import { assertEquals, assertExists } from "@std/assert";
import { Agent, tool } from "../mod.ts";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DoStreamResult = Awaited<ReturnType<MockLanguageModelV3["doStream"]>>;

function makeUsage() {
	return {
		inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined },
		outputTokens: { total: 5, text: undefined, reasoning: undefined },
	};
}

function textStream(text: string): DoStreamResult {
	return {
		stream: convertArrayToReadableStream([
			{ type: "text-delta" as const, id: "text-1", delta: text },
			{ type: "finish" as const, finishReason: { unified: "stop" as const, raw: undefined }, usage: makeUsage() },
		]),
	};
}

function toolCallStream(toolName: string, input: unknown, toolCallId = "tc1"): DoStreamResult {
	return {
		stream: convertArrayToReadableStream([
			{
				type: "tool-call" as const,
				toolCallId,
				toolName,
				input: JSON.stringify(input),
			},
			{ type: "finish" as const, finishReason: { unified: "tool-calls" as const, raw: undefined }, usage: makeUsage() },
		]),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("Agent - stream text", async () => {
	const model = new MockLanguageModelV3({
		doStream: textStream("1\n2\n3"),
	});

	const agent = new Agent({ model, systemPrompt: "Be concise." });
	const stream = agent.stream("Count from 1 to 3.");

	let collected = "";
	for await (const chunk of stream.textStream) {
		collected += chunk;
	}

	const output = await stream.output;
	assertEquals(collected, "1\n2\n3");
	assertEquals(output, collected);
});

Deno.test("Agent - stream structured output", async () => {
	const OutputSchema = z.object({ items: z.array(z.string()) });

	const model = new MockLanguageModelV3({
		doStream: toolCallStream("final_result", { items: ["red", "green", "blue"] }),
	});

	const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
		model,
		outputSchema: OutputSchema,
	});

	const stream = agent.stream("List 3 primary colors.");
	const output = await stream.output;

	assertExists(output.items);
	assertEquals(output.items, ["red", "green", "blue"]);
});

Deno.test("Agent - stream usage and messages", async () => {
	const model = new MockLanguageModelV3({
		doStream: textStream("ok"),
	});

	const agent = new Agent({ model, systemPrompt: "Be concise." });
	const stream = agent.stream("Say: ok");

	for await (const _ of stream.textStream) { /* drain */ }

	const streamUsage = await stream.usage;
	const messages = await stream.messages;

	assertEquals(streamUsage.requests, 1);
	assertEquals(streamUsage.inputTokens, 10);
	assertEquals(messages.length, 2); // user + assistant
});

Deno.test("Agent - stream multi-turn with tool call", async () => {
	let turnCount = 0;

	const echoTool = tool({
		name: "echo",
		description: "Echo a message",
		parameters: z.object({ msg: z.string() }),
		execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
	});

	const model = new MockLanguageModelV3({
		doStream: () => {
			turnCount++;
			return Promise.resolve(
				turnCount === 1
					? toolCallStream("echo", { msg: "hello" })
					: textStream("echo said: hello"),
			);
		},
	});

	const agent = new Agent({ model, tools: [echoTool] });
	const stream = agent.stream("Use echo.");

	let collected = "";
	for await (const chunk of stream.textStream) collected += chunk;

	assertEquals(collected, "echo said: hello");
	assertEquals(turnCount, 2);
});
