import { assertEquals } from "@std/assert";
import {
	Agent,
	tool,
	FunctionToolset,
	PreparedToolset,
} from "../mod.ts";
import {
	MockLanguageModelV3,
	mockValues,
	textResponse,
	toolCallResponse,
	type DoGenerateResult,
} from "./_helpers.ts";
import { z } from "zod";

type ToolEntry = { name: string; description?: string };

function toolNames(opts: { tools?: ToolEntry[] }): string[] {
	return (opts.tools ?? []).map((t) => t.name);
}

function makeTool(name: string) {
	return tool({
		name,
		description: `${name} tool`,
		parameters: z.object({}),
		execute: async () => `${name} result`,
	});
}

Deno.test("PreparedToolset - passes all inner tools through by default", async () => {
	let capturedNames: string[] = [];
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedNames = toolNames(opts);
			return Promise.resolve(textResponse("done"));
		},
	});

	const inner = new FunctionToolset([makeTool("alpha"), makeTool("beta")]);
	const prepared = new PreparedToolset(inner, (_ctx, tools) => tools);
	const agent = new Agent({ model, toolsets: [prepared] });
	await agent.run("go");

	assertEquals(capturedNames.includes("alpha"), true);
	assertEquals(capturedNames.includes("beta"), true);
});

Deno.test("PreparedToolset - prepare can filter individual tools", async () => {
	let capturedNames: string[] = [];
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedNames = toolNames(opts);
			return Promise.resolve(textResponse("done"));
		},
	});

	const inner = new FunctionToolset([makeTool("visible"), makeTool("hidden")]);
	const prepared = new PreparedToolset(
		inner,
		(_ctx, tools) => tools.filter((t) => t.name !== "hidden"),
	);
	const agent = new Agent({ model, toolsets: [prepared] });
	await agent.run("go");

	assertEquals(capturedNames.includes("visible"), true);
	assertEquals(capturedNames.includes("hidden"), false);
});

Deno.test("PreparedToolset - prepare can use deps to conditionally expose tools", async () => {
	type Deps = { showSecret: boolean };
	let capturedNames: string[] = [];

	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedNames = toolNames(opts);
			return Promise.resolve(textResponse("done"));
		},
	});

	const inner = new FunctionToolset<Deps>([
		makeTool("normal") as unknown as import("../mod.ts").ToolDefinition<Deps>,
		makeTool("secret") as unknown as import("../mod.ts").ToolDefinition<Deps>,
	]);
	const prepared = new PreparedToolset<Deps>(
		inner,
		(ctx, tools) =>
			ctx.deps.showSecret ? tools : tools.filter((t) => t.name !== "secret"),
	);
	const agent = new Agent<Deps>({ model, toolsets: [prepared] });

	// Secret hidden when deps.showSecret = false
	capturedNames = [];
	await agent.run("go", { deps: { showSecret: false } });
	assertEquals(capturedNames.includes("normal"), true);
	assertEquals(capturedNames.includes("secret"), false);

	// Secret visible when deps.showSecret = true
	capturedNames = [];
	await agent.run("go", { deps: { showSecret: true } });
	assertEquals(capturedNames.includes("normal"), true);
	assertEquals(capturedNames.includes("secret"), true);
});

Deno.test("PreparedToolset - prepare can return empty list", async () => {
	let capturedNames: string[] = [];
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedNames = toolNames(opts);
			return Promise.resolve(textResponse("done"));
		},
	});

	const inner = new FunctionToolset([makeTool("alpha")]);
	const prepared = new PreparedToolset(inner, () => []);
	const agent = new Agent({ model, toolsets: [prepared] });
	await agent.run("go");

	assertEquals(capturedNames.length, 0);
});

Deno.test("PreparedToolset - prepare receives correct tool list from inner toolset", async () => {
	let receivedToolNames: string[] = [];
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(textResponse("done")),
	});

	const inner = new FunctionToolset([makeTool("a"), makeTool("b"), makeTool("c")]);
	const prepared = new PreparedToolset(inner, (_ctx, tools) => {
		receivedToolNames = tools.map((t) => t.name);
		return tools;
	});
	const agent = new Agent({ model, toolsets: [prepared] });
	await agent.run("go");

	assertEquals(receivedToolNames.sort(), ["a", "b", "c"]);
});

Deno.test("PreparedToolset - async prepare function is awaited", async () => {
	let capturedNames: string[] = [];
	const model = new MockLanguageModelV3({
		doGenerate: (opts) => {
			capturedNames = toolNames(opts);
			return Promise.resolve(textResponse("done"));
		},
	});

	const inner = new FunctionToolset([makeTool("async_tool")]);
	const prepared = new PreparedToolset(inner, async (_ctx, tools) => {
		// Simulate async work (e.g. DB lookup)
		await Promise.resolve();
		return tools;
	});
	const agent = new Agent({ model, toolsets: [prepared] });
	await agent.run("go");

	assertEquals(capturedNames.includes("async_tool"), true);
});

Deno.test("PreparedToolset - prepare called on every turn", async () => {
	let prepareCallCount = 0;
	const responses = mockValues<DoGenerateResult>(
		toolCallResponse("my_tool", {}),
		textResponse("done"),
	);
	const model = new MockLanguageModelV3({
		doGenerate: () => Promise.resolve(responses()),
	});

	const inner = new FunctionToolset([makeTool("my_tool")]);
	const prepared = new PreparedToolset(inner, (_ctx, tools) => {
		prepareCallCount++;
		return tools;
	});
	const agent = new Agent({ model, toolsets: [prepared] });
	await agent.run("go");

	// Two model calls occur (tool call + final text), so prepare should be
	// called at least twice.
	assertEquals(prepareCallCount >= 2, true);
});
