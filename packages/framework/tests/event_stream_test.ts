/**
 * Tests for agent.runStreamEvents() — Phase 5.
 *
 * Covers:
 * - turn-start events
 * - text-delta events
 * - tool-call-start / tool-call-result events
 * - partial-output events (final_result streaming)
 * - final-result event
 * - usage-update event
 * - error event on MaxTurnsError
 * - multi-turn with tool call
 * - structured output (tool mode)
 * - override().runStreamEvents() respects _bypassModelRequestsCheck
 */
import { assertEquals, assertExists } from "@std/assert";
import { z } from "zod";
import { Agent, tool, setAllowModelRequests } from "../mod.ts";
import type { AgentStreamEvent } from "../mod.ts";
import {
	MockLanguageModelV3,
	textStream,
	toolCallStream,
	convertArrayToReadableStream,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Helper: drain all events into an array
// ---------------------------------------------------------------------------
async function collectEvents<T>(
	iterable: AsyncIterable<AgentStreamEvent<T>>,
): Promise<AgentStreamEvent<T>[]> {
	const events: AgentStreamEvent<T>[] = [];
	for await (const event of iterable) {
		events.push(event);
	}
	return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("runStreamEvents - emits turn-start and text-delta for plain text", async () => {
	const model = new MockLanguageModelV3({
		doStream: () => Promise.resolve(textStream("hello world")),
	});

	const agent = new Agent({ model });
	const events = await collectEvents(agent.runStreamEvents("hi"));

	const turnStarts = events.filter((e) => e.kind === "turn-start");
	const textDeltas = events.filter((e) => e.kind === "text-delta");
	const finalResults = events.filter((e) => e.kind === "final-result");

	assertEquals(turnStarts.length, 1);
	assertEquals((turnStarts[0] as { kind: "turn-start"; turn: number }).turn, 0);
	assertEquals(textDeltas.length >= 1, true);

	const joined = textDeltas
		.map((e) => (e as { kind: "text-delta"; delta: string }).delta)
		.join("");
	assertEquals(joined, "hello world");

	assertEquals(finalResults.length, 1);
	assertEquals(
		(finalResults[0] as { kind: "final-result"; output: string }).output,
		"hello world",
	);
});

Deno.test("runStreamEvents - emits usage-update after each turn", async () => {
	const model = new MockLanguageModelV3({
		doStream: () => Promise.resolve(textStream("ok")),
	});

	const agent = new Agent({ model });
	const events = await collectEvents(agent.runStreamEvents("go"));

	const usageUpdates = events.filter((e) => e.kind === "usage-update");
	assertEquals(usageUpdates.length, 1);

	const u = (usageUpdates[0] as { kind: "usage-update"; usage: { requests: number } }).usage;
	assertEquals(u.requests, 1);
});

Deno.test("runStreamEvents - final-result with structured output (tool mode)", async () => {
	const OutputSchema = z.object({ value: z.number() });

	const model = new MockLanguageModelV3({
		doStream: () => Promise.resolve(toolCallStream("final_result", { value: 42 })),
	});

	type Output = z.infer<typeof OutputSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: OutputSchema,
	});

	const events = await collectEvents(agent.runStreamEvents("get value"));

	const finalResults = events.filter((e) => e.kind === "final-result");
	assertEquals(finalResults.length, 1);

	const output = (finalResults[0] as { kind: "final-result"; output: Output }).output;
	assertEquals(output.value, 42);
});

Deno.test("runStreamEvents - emits tool-call-start for tool invocations", async () => {
	const echoTool = tool({
		name: "echo",
		description: "Echo a message",
		parameters: z.object({ msg: z.string() }),
		execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
	});

	let turnCount = 0;
	const model = new MockLanguageModelV3({
		doStream: () => {
			turnCount++;
			return Promise.resolve(
				turnCount === 1
					? toolCallStream("echo", { msg: "hi" })
					: textStream("done"),
			);
		},
	});

	const agent = new Agent({ model, tools: [echoTool] });
	const events = await collectEvents(agent.runStreamEvents("use echo"));

	const toolCallStarts = events.filter((e) => e.kind === "tool-call-start");
	assertEquals(toolCallStarts.length, 1);

	const tcs = toolCallStarts[0] as {
		kind: "tool-call-start";
		toolName: string;
		toolCallId: string;
		args: Record<string, unknown>;
	};
	assertEquals(tcs.toolName, "echo");
	assertExists(tcs.toolCallId);
	assertEquals(tcs.args.msg, "hi");
});

Deno.test("runStreamEvents - emits tool-call-result after tool execution", async () => {
	const echoTool = tool({
		name: "echo",
		description: "Echo a message",
		parameters: z.object({ msg: z.string() }),
		execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
	});

	let turnCount = 0;
	const model = new MockLanguageModelV3({
		doStream: () => {
			turnCount++;
			return Promise.resolve(
				turnCount === 1
					? toolCallStream("echo", { msg: "world" })
					: textStream("done"),
			);
		},
	});

	const agent = new Agent({ model, tools: [echoTool] });
	const events = await collectEvents(agent.runStreamEvents("use echo"));

	const toolResults = events.filter((e) => e.kind === "tool-call-result");
	assertEquals(toolResults.length, 1);

	const tr = toolResults[0] as {
		kind: "tool-call-result";
		toolCallId: string;
		toolName: string;
		result: unknown;
	};
	assertEquals(tr.toolName, "echo");
	assertEquals(tr.result, "world");
});

Deno.test("runStreamEvents - multi-turn emits turn-start for each turn", async () => {
	const echoTool = tool({
		name: "echo",
		description: "Echo",
		parameters: z.object({ msg: z.string() }),
		execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
	});

	let turnCount = 0;
	const model = new MockLanguageModelV3({
		doStream: () => {
			turnCount++;
			return Promise.resolve(
				turnCount === 1
					? toolCallStream("echo", { msg: "ping" })
					: textStream("pong"),
			);
		},
	});

	const agent = new Agent({ model, tools: [echoTool] });
	const events = await collectEvents(agent.runStreamEvents("ping pong"));

	const turnStarts = events.filter((e) => e.kind === "turn-start");
	assertEquals(turnStarts.length, 2);
	assertEquals((turnStarts[0] as { kind: "turn-start"; turn: number }).turn, 0);
	assertEquals((turnStarts[1] as { kind: "turn-start"; turn: number }).turn, 1);
});

Deno.test("runStreamEvents - emits partial-output for streaming final_result args", async () => {
	const OutputSchema = z.object({ name: z.string(), value: z.number() });
	type Output = z.infer<typeof OutputSchema>;

	const model = new MockLanguageModelV3({
		doStream: () =>
			Promise.resolve({
				stream: convertArrayToReadableStream([
					{
						type: "tool-input-start" as const,
						id: "tc1",
						toolName: "final_result",
						providerExecuted: false,
					},
					{
						type: "tool-input-delta" as const,
						id: "tc1",
						delta: '{"name":"Alice","value":',
					},
					{
						type: "tool-input-delta" as const,
						id: "tc1",
						delta: "99}",
					},
					{
						type: "tool-call" as const,
						toolCallId: "tc1",
						toolName: "final_result",
						input: JSON.stringify({ name: "Alice", value: 99 }),
					},
					{
						type: "tool-result" as const,
						toolCallId: "tc1",
						toolName: "final_result",
						result: { name: "Alice", value: 99 },
					},
					{
						type: "finish" as const,
						finishReason: { unified: "tool-calls" as const, raw: undefined },
						usage: {
							inputTokens: {
								total: 10,
								noCache: 10,
								cacheRead: 0,
								cacheWrite: undefined,
							},
							outputTokens: { total: 5, text: undefined, reasoning: undefined },
						},
					},
				]),
			}),
	});

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: OutputSchema,
	});

	const events = await collectEvents(agent.runStreamEvents("get data"));

	const partials = events.filter((e) => e.kind === "partial-output");
	assertEquals(partials.length >= 1, true);

	const lastPartial = partials[partials.length - 1] as {
		kind: "partial-output";
		partial: unknown;
	};
	const p = lastPartial.partial as Output;
	assertEquals(p.name, "Alice");
	assertEquals(p.value, 99);
});

Deno.test("runStreamEvents - error event on MaxTurns", async () => {
	const model = new MockLanguageModelV3({
		doStream: () => Promise.resolve(toolCallStream("nonexistent_tool", {})),
	});

	// Agent with no tools — every turn returns a tool call that can't be executed
	// → no text, no final_result → nudge → max retries exceeded
	// But without matching a schema, it loops until maxTurns
	const agent = new Agent({ model, maxTurns: 2 });
	const events = await collectEvents(agent.runStreamEvents("test"));

	// Should end with an error event since there's no resolution
	const errorEvents = events.filter((e) => e.kind === "error");
	assertEquals(errorEvents.length, 1);
});

Deno.test("runStreamEvents - override().runStreamEvents bypasses model request check", async () => {
	setAllowModelRequests(false);

	try {
		const model = new MockLanguageModelV3({
			doStream: () => Promise.resolve(textStream("bypassed")),
		});

		const agent = new Agent({ model });
		const events = await collectEvents(
			agent.override({ model }).runStreamEvents("test"),
		);

		const finalResults = events.filter((e) => e.kind === "final-result");
		assertEquals(finalResults.length, 1);
	} finally {
		setAllowModelRequests(true);
	}
});

Deno.test("runStreamEvents - event order: turn-start before text-delta before final-result", async () => {
	const model = new MockLanguageModelV3({
		doStream: () => Promise.resolve(textStream("hello")),
	});

	const agent = new Agent({ model });
	const events = await collectEvents(agent.runStreamEvents("hi"));

	const kinds = events.map((e) => e.kind);

	const turnStartIdx = kinds.indexOf("turn-start");
	const textDeltaIdx = kinds.indexOf("text-delta");
	const finalResultIdx = kinds.indexOf("final-result");

	assertEquals(turnStartIdx < textDeltaIdx, true);
	assertEquals(textDeltaIdx < finalResultIdx, true);
});

Deno.test("runStreamEvents - AsyncIterable can be consumed multiple times independently", async () => {
	// Each call to runStreamEvents returns a fresh AsyncIterable
	const model = new MockLanguageModelV3({
		doStream: () => Promise.resolve(textStream("fresh")),
	});

	const agent = new Agent({ model });

	const events1 = await collectEvents(agent.runStreamEvents("first"));
	const events2 = await collectEvents(agent.runStreamEvents("second"));

	const fr1 = events1.find((e) => e.kind === "final-result") as
		| { kind: "final-result"; output: string }
		| undefined;
	const fr2 = events2.find((e) => e.kind === "final-result") as
		| { kind: "final-result"; output: string }
		| undefined;

	assertExists(fr1);
	assertExists(fr2);
	assertEquals(fr1.output, "fresh");
	assertEquals(fr2.output, "fresh");
});
