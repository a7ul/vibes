import { assertEquals } from "@std/assert";
import { Agent } from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	textStream,
	type DoGenerateResult,
} from "./_helpers.ts";

Deno.test("newMessages - first run with no history", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: textResponse("hello"),
	});
	const agent = new Agent({ model });
	const result = await agent.run("hi");

	// messages = [user, assistant]
	// newMessages should be same as messages (no prior history)
	assertEquals(result.messages.length, 2);
	assertEquals(result.newMessages.length, 2);
	assertEquals(result.newMessages, result.messages);
});

Deno.test("newMessages - second run excludes prior history", async () => {
	const responses = mockValues<DoGenerateResult>(
		textResponse("first response"),
		textResponse("second response"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});
	const agent = new Agent({ model });

	const first = await agent.run("first");
	// Pass first run's messages as history to second run
	const second = await agent.run("second", { messageHistory: first.messages });

	assertEquals(second.messages.length, 4); // 2 from first + user + assistant
	// newMessages should only contain the user + assistant from the second run
	assertEquals(second.newMessages.length, 2);
	assertEquals(second.newMessages[0].role, "user");
	assertEquals(second.newMessages[1].role, "assistant");
});

Deno.test("newMessages - multi-turn run (tool call)", async () => {
	const responses = mockValues<DoGenerateResult>(
		textResponse("turn1"),
		textResponse("turn2"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const first = await new Agent({ model }).run("prompt");
	// newMessages length covers the 2 messages from this run
	assertEquals(first.newMessages.length, 2);
});

Deno.test("newMessages - stream result", async () => {
	const first = await new Agent({
		model: new MockLanguageModelV3({ doGenerate: textResponse("first response") }),
	}).run("first");

	const stream = new Agent({
		model: new MockLanguageModelV3({ doStream: textStream("second response") }),
	}).stream("second", { messageHistory: first.messages });
	for await (const _ of stream.textStream) {/* drain */}

	const newMsgs = await stream.newMessages;
	const allMsgs = await stream.messages;

	assertEquals(allMsgs.length, 4);
	assertEquals(newMsgs.length, 2);
});
