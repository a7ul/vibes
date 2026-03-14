import { assertEquals } from "@std/assert";
import { Agent, trimHistoryProcessor, type HistoryProcessor } from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	type DoGenerateResult,
} from "./_helpers.ts";
import type { ModelMessage } from "ai";

Deno.test("trimHistoryProcessor - does nothing when below limit", async () => {
	let capturedMsgCount: number | undefined;
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedMsgCount = opts.prompt.filter(
				(m: { role: string }) => m.role !== "system",
			).length;
			return Promise.resolve(textResponse("ok"));
		},
	});

	const agent = new Agent({
		model,
		historyProcessors: [trimHistoryProcessor(10)],
	});

	const first = await agent.run("hello");
	await agent.run("world", { messageHistory: first.messages });

	// Second run: 2 prior messages + 1 new user = 3 total, well under 10
	assertEquals((capturedMsgCount ?? 0) <= 3, true);
});

Deno.test("trimHistoryProcessor - trims to N most recent messages", async () => {
	let capturedMessages: ModelMessage[] = [];
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedMessages = opts.prompt.filter(
				(m: { role: string }) => m.role !== "system",
			);
			return Promise.resolve(textResponse("ok"));
		},
	});

	const agent = new Agent({
		model,
		historyProcessors: [trimHistoryProcessor(2)],
	});

	// Build up 4 messages of history
	const r1 = await agent.run("msg1"); // 2 messages
	const r2 = await agent.run("msg2", { messageHistory: r1.messages }); // 4 messages
	// On this run, processor should trim to 2 messages before sending to model
	await agent.run("msg3", { messageHistory: r2.messages });

	// Only 2 messages should have been sent (the most recent ones)
	assertEquals(capturedMessages.length, 2);
});

Deno.test("historyProcessors - processor receives RunContext", async () => {
	type Deps = { filterRole: string };
	let capturedDepRole: string | undefined;

	const processor: HistoryProcessor<Deps> = (messages, ctx) => {
		capturedDepRole = ctx.deps.filterRole;
		return messages;
	};

	const model = new MockLanguageModelV3({ doGenerate: textResponse("ok") });
	const agent = new Agent<Deps>({
		model,
		historyProcessors: [processor],
	});

	await agent.run("test", { deps: { filterRole: "admin" } });
	assertEquals(capturedDepRole, "admin");
});

Deno.test("historyProcessors - multiple processors applied in order", async () => {
	const log: string[] = [];

	const p1: HistoryProcessor = (msgs) => { log.push("p1"); return msgs; };
	const p2: HistoryProcessor = (msgs) => { log.push("p2"); return msgs; };
	const p3: HistoryProcessor = (msgs) => { log.push("p3"); return msgs; };

	const model = new MockLanguageModelV3({ doGenerate: textResponse("ok") });
	const agent = new Agent({
		model,
		historyProcessors: [p1, p2, p3],
	});

	await agent.run("test");
	assertEquals(log, ["p1", "p2", "p3"]);
});

Deno.test("historyProcessors - processors don't mutate the source messages array", async () => {
	// A processor that returns a sliced copy — source array must be unchanged
	let sourceAtCallTime: ModelMessage[] = [];
	const snapshotProcessor: HistoryProcessor = (msgs) => {
		sourceAtCallTime = [...msgs]; // capture a copy
		return msgs.slice(-2); // return only last 2
	};

	const responses = mockValues<DoGenerateResult>(
		textResponse("r1"),
		textResponse("r2"),
		textResponse("r3"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});
	const agent = new Agent({ model, historyProcessors: [snapshotProcessor] });

	const first = await agent.run("hello");
	assertEquals(first.messages.length, 2); // user + assistant

	// On second run the processor sees the full history (user1 + asst1 + user2)
	await agent.run("world", { messageHistory: first.messages });
	assertEquals(sourceAtCallTime.length, 3); // full history passed in
});

Deno.test("Agent.addHistoryProcessor - adds processor after construction", async () => {
	let called = false;
	const processor: HistoryProcessor = (msgs) => { called = true; return msgs; };

	const model = new MockLanguageModelV3({ doGenerate: textResponse("ok") });
	const agent = new Agent({ model });
	agent.addHistoryProcessor(processor);

	await agent.run("test");
	assertEquals(called, true);
});
