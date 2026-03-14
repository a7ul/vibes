/**
 * Tests for outputTemplate option (3.7):
 * - outputTemplate: false suppresses schema injection from system prompt
 * - Works with all outputMode values
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { z } from "zod";
import { Agent } from "../mod.ts";
import {
	MockLanguageModelV3,
	textResponse,
	toolCallResponse,
} from "./_helpers.ts";

const OutputSchema = z.object({ value: z.number() });

Deno.test("outputTemplate: false - no schema in system prompt for tool mode", async () => {
	// In tool mode, outputTemplate: false shouldn't matter much for the system
	// prompt since schema isn't injected into system prompt anyway.
	// But we verify the agent still works.
	const model = new MockLanguageModelV3({
		doGenerate: toolCallResponse("final_result", { value: 42 }),
	});

	type Output = z.infer<typeof OutputSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: OutputSchema,
		outputTemplate: false,
	});

	const result = await agent.run("give me a number");
	assertEquals(result.output.value, 42);
});

Deno.test("outputTemplate: true (default) - schema in system prompt for prompted mode", async () => {
	let capturedSystem = "";

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			const sysMsg = opts.prompt.find(
				(m: { role: string }) => m.role === "system",
			);
			capturedSystem =
				typeof sysMsg?.content === "string" ? sysMsg.content : "";
			return Promise.resolve(
				textResponse(JSON.stringify({ value: 7 })),
			);
		},
	});

	const agent = new Agent({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
		outputTemplate: true, // explicit default
		systemPrompt: "You are helpful.",
	});

	await agent.run("give me a number");

	assertStringIncludes(capturedSystem, "schema");
	assertStringIncludes(capturedSystem, "You are helpful.");
});

Deno.test("outputTemplate: false - no schema injected for prompted mode", async () => {
	let capturedSystem = "";

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			const sysMsg = opts.prompt.find(
				(m: { role: string }) => m.role === "system",
			);
			capturedSystem =
				typeof sysMsg?.content === "string" ? sysMsg.content : "";
			return Promise.resolve(
				textResponse(JSON.stringify({ value: 7 })),
			);
		},
	});

	const agent = new Agent({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
		outputTemplate: false,
		systemPrompt: "You are helpful.",
	});

	await agent.run("give me a number");

	// Schema should NOT appear in system prompt
	assertEquals(capturedSystem.includes("<schema>"), false);
	// Original system prompt should still be present
	assertStringIncludes(capturedSystem, "You are helpful.");
});

Deno.test("outputTemplate: false - agent with no systemPrompt still has no schema injection", async () => {
	let capturedSystem: string | undefined;

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			const sysMsg = opts.prompt.find(
				(m: { role: string }) => m.role === "system",
			);
			capturedSystem =
				typeof sysMsg?.content === "string" ? sysMsg.content : undefined;
			return Promise.resolve(
				textResponse(JSON.stringify({ value: 7 })),
			);
		},
	});

	const agent = new Agent({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
		outputTemplate: false,
	});

	await agent.run("give me a number");

	// No system message at all when template=false and no systemPrompt set
	assertEquals(capturedSystem, undefined);
});
