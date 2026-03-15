/**
 * Tests for FunctionModel - custom-function-driven language model.
 */
import { assertEquals, assertExists } from "@std/assert";
import { z } from "zod";
import { Agent, tool } from "../mod.ts";
import {
  FunctionModel,
  type ModelFunctionParams,
} from "../lib/testing/function_model.ts";
import {
  type DoGenerateResult,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Basic text response
// ---------------------------------------------------------------------------

Deno.test("FunctionModel - returns text response", async () => {
  const model = new FunctionModel(() => textResponse("hello from function"));
  const agent = new Agent({ model });
  const result = await agent.run("Say hello");
  assertEquals(result.output, "hello from function");
});

Deno.test("FunctionModel - can use mockValues for multi-turn", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("search", { query: "test" }),
    textResponse("The answer is 42"),
  );

  const searchTool = tool({
    name: "search",
    description: "Search for info",
    parameters: z.object({ query: z.string() }),
    execute: (_ctx, args) => Promise.resolve(`Results for: ${args.query}`),
  });

  const model = new FunctionModel(() => Promise.resolve(responses()));
  const agent = new Agent({ model, tools: [searchTool] });

  const result = await agent.run("Find the answer");
  assertEquals(result.output, "The answer is 42");
  assertEquals(result.usage.requests, 2);
});

// ---------------------------------------------------------------------------
// Turn tracking
// ---------------------------------------------------------------------------

Deno.test("FunctionModel - receives turn number starting at 0", async () => {
  const turns: number[] = [];

  const model = new FunctionModel(({ turn }) => {
    turns.push(turn);
    return textResponse("done");
  });

  const agent = new Agent({ model });
  await agent.run("Hello");

  assertEquals(turns.length, 1);
  assertEquals(turns[0], 0);
});

Deno.test("FunctionModel - turn increments correctly", async () => {
  const turns: number[] = [];

  const searchTool = tool({
    name: "search",
    description: "Search",
    parameters: z.object({ q: z.string() }),
    execute: () => Promise.resolve("result"),
  });

  const model = new FunctionModel(({ turn }) => {
    turns.push(turn);
    if (turn === 0) {
      return toolCallResponse("search", { q: "test" }, `tc-${turn}`);
    }
    return textResponse("done");
  });

  const agent = new Agent({ model, tools: [searchTool] });
  await agent.run("Search for something");

  assertEquals(turns.length, 2);
  assertEquals(turns[0], 0);
  assertEquals(turns[1], 1);
});

// ---------------------------------------------------------------------------
// Tool introspection
// ---------------------------------------------------------------------------

Deno.test("FunctionModel - receives available tools", async () => {
  let capturedTools: ModelFunctionParams["tools"] = [];

  const myTool = tool({
    name: "my_tool",
    description: "My test tool",
    parameters: z.object({ input: z.string() }),
    execute: () => Promise.resolve("result"),
  });

  const model = new FunctionModel(({ tools }) => {
    capturedTools = tools;
    return textResponse("done");
  });

  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("Hello");

  // Tools include my_tool plus final_result (injected by agent)
  const toolNames = capturedTools.map((t) => t.name);
  assertEquals(toolNames.includes("my_tool"), true);
});

Deno.test("FunctionModel - receives messages", async () => {
  let capturedMessages: ModelFunctionParams["messages"] = [];

  const model = new FunctionModel(({ messages }) => {
    capturedMessages = messages;
    return textResponse("done");
  });

  const agent = new Agent({ model });
  await agent.run("test prompt");

  assertExists(capturedMessages);
  assertEquals(capturedMessages.length > 0, true);

  // First message should be the user prompt
  const userMsg = capturedMessages.find((m: { role: string }) =>
    m.role === "user"
  );
  assertExists(userMsg);
});

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

Deno.test("FunctionModel - structured output via final_result", async () => {
  const OutputSchema = z.object({ name: z.string(), score: z.number() });

  const model = new FunctionModel(() =>
    toolCallResponse("final_result", { name: "Alice", score: 95 })
  );

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });

  const result = await agent.run("Get data");
  assertEquals(result.output.name, "Alice");
  assertEquals(result.output.score, 95);
});

// ---------------------------------------------------------------------------
// Async function
// ---------------------------------------------------------------------------

Deno.test("FunctionModel - supports async functions", async () => {
  const model = new FunctionModel(async ({ turn }) => {
    // Simulate async work
    await Promise.resolve();
    return textResponse(`turn ${turn}`);
  });

  const agent = new Agent({ model });
  const result = await agent.run("Hello");
  assertEquals(result.output, "turn 0");
});

// ---------------------------------------------------------------------------
// agent.override integration
// ---------------------------------------------------------------------------

Deno.test("FunctionModel - works with agent.override", async () => {
  const OutputSchema = z.object({ answer: z.string() });
  const realModel = new FunctionModel(() => textResponse("real")); // stand-in for real model
  const testModel = new FunctionModel(() =>
    toolCallResponse("final_result", { answer: "test answer" })
  );

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model: realModel,
    outputSchema: OutputSchema,
  });

  const result = await agent.override({ model: testModel }).run(
    "What is the answer?",
  );
  assertEquals(result.output.answer, "test answer");
});

// ---------------------------------------------------------------------------
// Custom response shapes
// ---------------------------------------------------------------------------

Deno.test("FunctionModel - can return tool calls with custom input", async () => {
  let receivedInput: unknown;

  const calcTool = tool({
    name: "calculate",
    description: "Calculate something",
    parameters: z.object({ a: z.number(), b: z.number() }),
    execute: (_ctx, args) => {
      receivedInput = args;
      return Promise.resolve(String(args.a + args.b));
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("calculate", { a: 3, b: 7 }),
    textResponse("The result is 10"),
  );

  const model = new FunctionModel(() => Promise.resolve(responses()));
  const agent = new Agent({ model, tools: [calcTool] });

  await agent.run("Calculate 3 + 7");
  assertEquals(receivedInput, { a: 3, b: 7 });
});
