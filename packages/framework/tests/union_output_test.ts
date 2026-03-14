/**
 * Tests for union output types (3.1): outputSchema as ZodTypeAny[].
 *
 * When outputSchema is an array, the agent registers final_result_0,
 * final_result_1, etc. and parses with the matching schema.
 */
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { z } from "zod";
import { Agent } from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	toolCallResponse,
	textResponse,
	type DoGenerateResult,
} from "./_helpers.ts";

const PersonSchema = z.object({ name: z.string(), age: z.number() });
const ErrorSchema = z.object({ error: z.string(), code: z.number() });

Deno.test("union output - registers final_result_0 and final_result_1 tools", async () => {
	const capturedToolNames: string[] = [];

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			for (const t of opts.tools ?? []) {
				capturedToolNames.push(t.name);
			}
			return Promise.resolve(
				toolCallResponse("final_result_0", { name: "Alice", age: 30 }),
			);
		},
	});

	const agent = new Agent({
		model,
		outputSchema: [PersonSchema, ErrorSchema],
	});

	await agent.run("get person");

	assertEquals(capturedToolNames.includes("final_result_0"), true);
	assertEquals(capturedToolNames.includes("final_result_1"), true);
	assertEquals(capturedToolNames.includes("final_result"), false);
});

Deno.test("union output - first schema variant succeeds", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: toolCallResponse("final_result_0", { name: "Alice", age: 30 }),
	});

	type Output = z.infer<typeof PersonSchema> | z.infer<typeof ErrorSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: [PersonSchema, ErrorSchema],
	});

	const result = await agent.run("get person");
	assertEquals((result.output as z.infer<typeof PersonSchema>).name, "Alice");
	assertEquals((result.output as z.infer<typeof PersonSchema>).age, 30);
});

Deno.test("union output - second schema variant succeeds", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: toolCallResponse("final_result_1", { error: "Not found", code: 404 }),
	});

	type Output = z.infer<typeof PersonSchema> | z.infer<typeof ErrorSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: [PersonSchema, ErrorSchema],
	});

	const result = await agent.run("get person");
	assertEquals((result.output as z.infer<typeof ErrorSchema>).error, "Not found");
	assertEquals((result.output as z.infer<typeof ErrorSchema>).code, 404);
});

Deno.test("union output - single schema still uses final_result tool name", async () => {
	const capturedToolNames: string[] = [];

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			for (const t of opts.tools ?? []) {
				capturedToolNames.push(t.name);
			}
			return Promise.resolve(
				toolCallResponse("final_result", { name: "Bob", age: 25 }),
			);
		},
	});

	const agent = new Agent({
		model,
		outputSchema: PersonSchema,
	});

	await agent.run("get person");

	assertEquals(capturedToolNames.includes("final_result"), true);
	assertEquals(capturedToolNames.includes("final_result_0"), false);
});

Deno.test("union output - result validator failure triggers retry", async () => {
	// Use a result validator that rejects the first valid output and accepts the second
	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("final_result_0", { name: "Alice", age: 30 }),
		toolCallResponse("final_result_0", { name: "Bob", age: 25 }),
	);

	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	type Output = z.infer<typeof PersonSchema> | z.infer<typeof ErrorSchema>;
	let callCount = 0;

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: [PersonSchema, ErrorSchema],
		resultValidators: [
			(_ctx, output) => {
				callCount++;
				if (callCount === 1) throw new Error("Reject first attempt");
				return output;
			},
		],
	});

	const result = await agent.run("get person");
	assertEquals((result.output as z.infer<typeof PersonSchema>).name, "Bob");
	assertEquals(result.retryCount, 1);
});

Deno.test("union output - result validators run on union output", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: toolCallResponse("final_result_0", { name: "Alice", age: 30 }),
	});

	let validatorCalled = false;
	type Output = z.infer<typeof PersonSchema> | z.infer<typeof ErrorSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: [PersonSchema, ErrorSchema],
		resultValidators: [
			(_ctx, output) => {
				validatorCalled = true;
				return output;
			},
		],
	});

	await agent.run("get person");
	assertEquals(validatorCalled, true);
});

Deno.test("union output - maxRetries exceeded throws MaxRetriesError", async () => {
	const model = new MockLanguageModelV3({
		doGenerate: () =>
			Promise.resolve(textResponse("no tool called")),
	});

	type Output = z.infer<typeof PersonSchema> | z.infer<typeof ErrorSchema>;

	const agent = new Agent<undefined, Output>({
		model,
		outputSchema: [PersonSchema, ErrorSchema],
		maxRetries: 1,
		maxTurns: 5,
	});

	await assertRejects(
		() => agent.run("get person"),
		Error,
	);
});
