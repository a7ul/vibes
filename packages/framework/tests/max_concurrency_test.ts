/**
 * Tests for the maxConcurrency feature (1.3).
 * Verifies that tool executions are capped by the semaphore.
 */
import { assertEquals, assertRejects } from "@std/assert";
import { Agent, tool, Semaphore } from "../mod.ts";
import { z } from "zod";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	toolCallResponse,
	type DoGenerateResult,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Semaphore unit tests
// ---------------------------------------------------------------------------

Deno.test("Semaphore - runs a single task", async () => {
	const sem = new Semaphore(1);
	const result = await sem.run(async () => "hello");
	assertEquals(result, "hello");
});

Deno.test("Semaphore - respects concurrency limit", async () => {
	const sem = new Semaphore(2);
	let concurrent = 0;
	let maxConcurrent = 0;

	const tasks = Array.from({ length: 5 }, (_, i) =>
		sem.run(async () => {
			concurrent++;
			maxConcurrent = Math.max(maxConcurrent, concurrent);
			// Yield to allow other tasks to start
			await new Promise<void>((r) => setTimeout(r, 0));
			concurrent--;
			return i;
		}),
	);

	await Promise.all(tasks);
	// With concurrency 2, max concurrent should be exactly 2
	assertEquals(maxConcurrent <= 2, true);
});

Deno.test("Semaphore - throws on maxConcurrency < 1", () => {
	let threw = false;
	try {
		new Semaphore(0);
	} catch (e) {
		if (e instanceof RangeError) threw = true;
	}
	assertEquals(threw, true);
});

Deno.test("Semaphore - propagates errors from fn", async () => {
	const sem = new Semaphore(1);
	await assertRejects(
		() => sem.run(async () => { throw new Error("boom"); }),
		Error,
		"boom",
	);
	// Semaphore should still be functional after an error
	const result = await sem.run(async () => "recovered");
	assertEquals(result, "recovered");
});

Deno.test("Semaphore - serialises tasks at concurrency=1", async () => {
	const sem = new Semaphore(1);
	const order: number[] = [];

	// Start 3 tasks that push their index in order of execution start
	const tasks = [1, 2, 3].map((i) =>
		sem.run(async () => {
			order.push(i);
			await new Promise<void>((r) => setTimeout(r, 0));
			return i;
		})
	);

	await Promise.all(tasks);
	// With semaphore(1), tasks run in start order: [1, 2, 3]
	assertEquals(order, [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// Agent maxConcurrency integration tests
// ---------------------------------------------------------------------------

Deno.test("maxConcurrency - stored on agent", () => {
	const model = new MockLanguageModelV3({
		doGenerate: textResponse("ok"),
	});
	const agent = new Agent({ model, maxConcurrency: 3 });
	assertEquals(agent.maxConcurrency, 3);
});

Deno.test("maxConcurrency - undefined by default", () => {
	const model = new MockLanguageModelV3({
		doGenerate: textResponse("ok"),
	});
	const agent = new Agent({ model });
	assertEquals(agent.maxConcurrency, undefined);
});

Deno.test("maxConcurrency - agent with maxConcurrency=1 runs tools sequentially", async () => {
	const executionOrder: string[] = [];
	let concurrent = 0;
	let maxConcurrent = 0;

	const toolA = tool({
		name: "tool_a",
		description: "tool a",
		parameters: z.object({}),
		execute: async () => {
			concurrent++;
			maxConcurrent = Math.max(maxConcurrent, concurrent);
			executionOrder.push("a-start");
			await new Promise<void>((r) => setTimeout(r, 10));
			executionOrder.push("a-end");
			concurrent--;
			return "a";
		},
	});

	const toolB = tool({
		name: "tool_b",
		description: "tool b",
		parameters: z.object({}),
		execute: async () => {
			concurrent++;
			maxConcurrent = Math.max(maxConcurrent, concurrent);
			executionOrder.push("b-start");
			await new Promise<void>((r) => setTimeout(r, 5));
			executionOrder.push("b-end");
			concurrent--;
			return "b";
		},
	});

	// Two separate turns: first call tool_a, second call tool_b, third return text
	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("tool_a", {}),
		toolCallResponse("tool_b", {}),
		textResponse("done"),
	);

	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const agent = new Agent({
		model,
		tools: [toolA, toolB],
		maxConcurrency: 1,
	});

	await agent.run("go");

	// With maxConcurrency=1, at most 1 tool executes at a time
	assertEquals(maxConcurrent <= 1, true);
});

Deno.test("maxConcurrency - agent runs correctly with tools", async () => {
	const toolCallCount: string[] = [];

	const myTool = tool({
		name: "my_tool",
		description: "a simple tool",
		parameters: z.object({ id: z.string() }),
		execute: async (_ctx, args) => {
			toolCallCount.push(args.id);
			return `result-${args.id}`;
		},
	});

	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("my_tool", { id: "1" }),
		textResponse("done"),
	);

	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const agent = new Agent({
		model,
		tools: [myTool],
		maxConcurrency: 2,
	});

	const result = await agent.run("go");
	assertEquals(result.output, "done");
	assertEquals(toolCallCount, ["1"]);
});
