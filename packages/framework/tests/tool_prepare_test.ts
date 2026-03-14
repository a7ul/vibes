import { assertEquals } from "@std/assert";
import { Agent, tool, type RunContext, type ToolDefinition } from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	toolCallResponse,
	type DoGenerateResult,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("tool.prepare - returning tool includes it", async () => {
	let prepareCallCount = 0;
	let toolNamesSeenByModel: string[] = [];

	const includedDef = z.object({});
	const myTool: ToolDefinition<undefined> = {
		name: "included",
		description: "Always included",
		parameters: includedDef,
		prepare: (ctx) => {
			prepareCallCount++;
			return ctx ? myTool : undefined; // always include
		},
		execute: async () => "executed",
	};

	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("included", {}),
		textResponse("done"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			toolNamesSeenByModel = (opts.tools ?? []).map(
				(t: { name: string }) => t.name,
			);
			return Promise.resolve(responses());
		},
	});

	const agent = new Agent({ model, tools: [myTool] });
	await agent.run("use the tool");

	assertEquals(prepareCallCount >= 1, true);
	assertEquals(toolNamesSeenByModel.includes("included"), true);
});

Deno.test("tool.prepare - returning null excludes tool from turn", async () => {
	type Deps = { isAdmin: boolean };
	let capturedToolNames: string[] = [];

	const adminDef = z.object({});
	const adminTool: ToolDefinition<Deps> = {
		name: "admin_action",
		description: "Admin only",
		parameters: adminDef,
		prepare: (ctx: RunContext<Deps>) => {
			return ctx.deps.isAdmin ? adminTool : null;
		},
		execute: async () => "admin executed",
	};

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedToolNames = (opts.tools ?? []).map(
				(t: { name: string }) => t.name,
			);
			return Promise.resolve(textResponse("response"));
		},
	});

	const agent = new Agent<Deps>({ model, tools: [adminTool] });

	capturedToolNames = [];
	await agent.run("do something", { deps: { isAdmin: false } });
	assertEquals(capturedToolNames.includes("admin_action"), false);

	capturedToolNames = [];
	await agent.run("do something", { deps: { isAdmin: true } });
	assertEquals(capturedToolNames.includes("admin_action"), true);
});

Deno.test("tool.prepare - can modify tool description per turn", async () => {
	type Deps = { language: string };
	let capturedDescription: string | undefined;

	const greetTool: ToolDefinition<Deps> = {
		name: "greet",
		description: "original description",
		parameters: z.object({}),
		prepare: (ctx: RunContext<Deps>) => ({
			name: "greet",
			description: `Greet in ${ctx.deps.language}`,
			parameters: z.object({}),
			execute: async () => `greet in ${ctx.deps.language}`,
		}),
		execute: async () => "greet",
	};

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			const greetEntry = (opts.tools ?? []).find(
				(t: { name: string }) => t.name === "greet",
			);
			capturedDescription = (greetEntry as { name: string; description?: string })?.description;
			return Promise.resolve(textResponse("done"));
		},
	});

	const agent = new Agent<Deps>({ model, tools: [greetTool] });
	await agent.run("say hello", { deps: { language: "French" } });
	assertEquals(capturedDescription?.includes("French"), true);
});
