/**
 * Tests for prompted output mode (3.3):
 * - Schema injected into system prompt
 * - Model returns JSON text response
 * - Parsed against Zod schema
 */
import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { z } from "zod";
import { Agent } from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	toolCallResponse,
	type DoGenerateResult,
} from "./_helpers.ts";

const OutputSchema = z.object({ name: z.string(), capital: z.string() });

Deno.test("prompted output - schema injected into system prompt", async () => {
	let capturedSystem: string | undefined;

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			const sysMsg = opts.prompt.find(
				(m: { role: string }) => m.role === "system",
			);
			capturedSystem =
				typeof sysMsg?.content === "string" ? sysMsg.content : undefined;
			return Promise.resolve(
				textResponse(JSON.stringify({ name: "France", capital: "Paris" })),
			);
		},
	});

	const agent = new Agent({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
	});

	await agent.run("Capital of France?");

	assertExists(capturedSystem);
	assertStringIncludes(capturedSystem, "schema");
});

Deno.test("prompted output - parses JSON text response", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: textResponse(
			JSON.stringify({ name: "France", capital: "Paris" }),
		),
	});

	type Output = z.infer<typeof OutputSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
	});

	const result = await agent.run("Capital of France?");
	assertEquals(result.output.name, "France");
	assertEquals(result.output.capital, "Paris");
});

Deno.test("prompted output - invalid JSON nudges retry", async () => {
	const responses = mockValues<DoGenerateResult>(
		textResponse("not valid json"),
		textResponse(JSON.stringify({ name: "France", capital: "Paris" })),
	);

	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	type Output = z.infer<typeof OutputSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
	});

	const result = await agent.run("Capital of France?");
	assertEquals(result.output.name, "France");
	assertEquals(result.retryCount, 1);
});

Deno.test("prompted output - schema validation failure nudges retry", async () => {
	const responses = mockValues<DoGenerateResult>(
		// Missing required 'capital' field
		textResponse(JSON.stringify({ name: "France" })),
		textResponse(JSON.stringify({ name: "France", capital: "Paris" })),
	);

	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	type Output = z.infer<typeof OutputSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
	});

	const result = await agent.run("Capital of France?");
	assertEquals(result.output.capital, "Paris");
	assertEquals(result.retryCount, 1);
});

Deno.test("prompted output - outputTemplate false suppresses schema prompt", async () => {
	let capturedSystem: string | undefined;

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			const sysMsg = opts.prompt.find(
				(m: { role: string }) => m.role === "system",
			);
			capturedSystem =
				typeof sysMsg?.content === "string" ? sysMsg.content : undefined;
			return Promise.resolve(
				textResponse(JSON.stringify({ name: "France", capital: "Paris" })),
			);
		},
	});

	const agent = new Agent({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
		outputTemplate: false,
		systemPrompt: "You are a helpful assistant.",
	});

	await agent.run("Capital of France?");

	// Schema should NOT be in system prompt
	assertEquals(capturedSystem, "You are a helpful assistant.");
});

Deno.test("prompted output - union schemas try each variant", async () => {
	const ErrorSchema = z.object({ error: z.string(), code: z.number() });

	const model = new MockLanguageModelV3({
		doGenerate: textResponse(
			JSON.stringify({ error: "Not found", code: 404 }),
		),
	});

	type Output = z.infer<typeof OutputSchema> | z.infer<typeof ErrorSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputMode: "prompted",
		outputSchema: [OutputSchema, ErrorSchema],
	});

	const result = await agent.run("Capital of X?");
	const output = result.output as z.infer<typeof ErrorSchema>;
	assertEquals(output.error, "Not found");
	assertEquals(output.code, 404);
});

Deno.test("prompted output - result validators run", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: textResponse(
			JSON.stringify({ name: "France", capital: "Paris" }),
		),
	});

	let validatorCalled = false;
	type Output = z.infer<typeof OutputSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
		resultValidators: [
			(_ctx, output) => {
				validatorCalled = true;
				return output;
			},
		],
	});

	await agent.run("Capital of France?");
	assertEquals(validatorCalled, true);
});

Deno.test("prompted output - does not register final_result tool", async () => {
	const capturedToolNames: string[] = [];

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			for (const t of opts.tools ?? []) {
				capturedToolNames.push(t.name);
			}
			return Promise.resolve(
				textResponse(JSON.stringify({ name: "France", capital: "Paris" })),
			);
		},
	});

	const agent = new Agent({
		model,
		outputMode: "prompted",
		outputSchema: OutputSchema,
	});

	await agent.run("Capital of France?");

	assertEquals(capturedToolNames.includes("final_result"), false);
	assertEquals(capturedToolNames.includes("final_result_0"), false);
});

Deno.test("prompted output - output tool result ends run even in prompted mode", async () => {
	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("user_tool", { result: "done" }),
		textResponse(JSON.stringify({ name: "France", capital: "Paris" })),
	);

	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	let toolCalled = false;

	const agent = new Agent({
		model,
		outputMode: "prompted" as const,
		outputSchema: OutputSchema,
		tools: [
			{
				name: "user_tool",
				description: "A user-defined output tool",
				parameters: z.object({ result: z.string() }),
				isOutput: true,
				execute: async (_ctx, args: unknown) => {
					toolCalled = true;
					return (args as { result: string }).result;
				},
			},
		],
	});

	const result = await agent.run("do something");
	// The output tool result should end the run
	assertEquals(toolCalled, true);
	assertEquals(result.output as unknown, "done");
});
