import { assertEquals } from "@std/assert";
import { Agent, plainTool } from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	toolCallResponse,
	type DoGenerateResult,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("plainTool - executes without RunContext", async () => {
	const addTool = plainTool({
		name: "add",
		description: "Add two numbers",
		parameters: z.object({ a: z.number(), b: z.number() }),
		execute: async ({ a, b }) => String(a + b),
	});

	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("add", { a: 3, b: 4 }),
		textResponse("The sum is 7"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const agent = new Agent({ model, tools: [addTool] });
	const result = await agent.run("What is 3 + 4?");

	assertEquals(result.output.includes("7"), true);
});

Deno.test("plainTool - maxRetries works", async () => {
	let callCount = 0;
	const flakyTool = plainTool({
		name: "flaky",
		description: "Fails once",
		parameters: z.object({}),
		maxRetries: 1,
		execute: async () => {
			callCount++;
			if (callCount === 1) throw new Error("transient");
			return "ok";
		},
	});

	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("flaky", {}),
		textResponse("done"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const agent = new Agent({ model, tools: [flakyTool] });
	await agent.run("use flaky");
	assertEquals(callCount, 2);
});
