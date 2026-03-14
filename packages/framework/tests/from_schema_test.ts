import { assertEquals, assertInstanceOf } from "@std/assert";
import { Agent, fromSchema } from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	toolCallResponse,
	type DoGenerateResult,
} from "./_helpers.ts";

Deno.test("fromSchema - builds tool from raw JSON schema and executes", async () => {
	const echoTool = fromSchema({
		name: "echo",
		description: "Echo a message",
		jsonSchema: {
			type: "object",
			properties: { message: { type: "string" } },
			required: ["message"],
		},
		execute: async (_ctx, args) => `echoed: ${args.message as string}`,
	});

	assertEquals(echoTool.name, "echo");
	assertEquals(echoTool.description, "Echo a message");
	assertInstanceOf(echoTool.parameters, Object);

	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("echo", { message: "hello" }),
		textResponse("the tool said: echoed: hello"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const agent = new Agent({ model, tools: [echoTool] });
	const result = await agent.run("echo hello");
	assertEquals(result.output.includes("echoed"), true);
});

Deno.test("fromSchema - respects maxRetries", async () => {
	let callCount = 0;
	const flakyTool = fromSchema({
		name: "flaky",
		description: "Flaky tool",
		jsonSchema: { type: "object", properties: {} },
		maxRetries: 2,
		execute: async () => {
			callCount++;
			if (callCount < 3) throw new Error("transient");
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
	await agent.run("run flaky");
	assertEquals(callCount, 3);
});

Deno.test("fromSchema - passes args as Record<string, unknown>", async () => {
	let receivedArgs: Record<string, unknown> = {};
	const captureTool = fromSchema({
		name: "capture",
		description: "Capture args",
		jsonSchema: {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
		},
		execute: async (_ctx, args) => {
			receivedArgs = args;
			return "captured";
		},
	});

	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("capture", { name: "Alice", age: 30 }),
		textResponse("done"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const agent = new Agent({ model, tools: [captureTool] });
	await agent.run("capture args");
	assertEquals(receivedArgs.name, "Alice");
	assertEquals(receivedArgs.age, 30);
});
