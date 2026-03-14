/**
 * Tests for TestModel — schema-aware mock language model.
 */
import { assertEquals, assertExists } from "@std/assert";
import { z } from "zod";
import { Agent, tool } from "../mod.ts";
import { createTestModel, TestModel } from "../lib/testing/test_model.ts";

// ---------------------------------------------------------------------------
// Basic text response
// ---------------------------------------------------------------------------

Deno.test("TestModel - returns text when no outputSchema", async () => {
  const model = new TestModel({ text: "hello from test" });
  const agent = new Agent({ model });
  const result = await agent.run("Say hello");
  assertEquals(result.output, "hello from test");
});

Deno.test("TestModel - default text response", async () => {
  const model = new TestModel();
  const agent = new Agent({ model });
  const result = await agent.run("Say something");
  assertEquals(typeof result.output, "string");
  assertExists(result.output);
});

// ---------------------------------------------------------------------------
// Structured output (final_result)
// ---------------------------------------------------------------------------

Deno.test("TestModel - generates valid final_result for string schema", async () => {
  const OutputSchema = z.object({ message: z.string() });
  const model = new TestModel({ callTools: false });
  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });
  const result = await agent.run("Give me a message");
  assertEquals(typeof result.output.message, "string");
});

Deno.test("TestModel - generates valid final_result for number schema", async () => {
  const OutputSchema = z.object({ score: z.number() });
  const model = new TestModel({ callTools: false });
  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });
  const result = await agent.run("Give me a score");
  assertEquals(typeof result.output.score, "number");
});

Deno.test("TestModel - generates valid final_result for boolean schema", async () => {
  const OutputSchema = z.object({ active: z.boolean() });
  const model = new TestModel({ callTools: false });
  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });
  const result = await agent.run("Is it active?");
  assertEquals(typeof result.output.active, "boolean");
});

Deno.test("TestModel - generates valid final_result for nested schema", async () => {
  const OutputSchema = z.object({
    user: z.object({
      name: z.string(),
      age: z.number(),
    }),
    tags: z.array(z.string()),
  });
  const model = new TestModel({ callTools: false });
  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });
  const result = await agent.run("Give me user data");
  assertEquals(typeof result.output.user.name, "string");
  assertEquals(typeof result.output.user.age, "number");
  assertEquals(Array.isArray(result.output.tags), true);
});

// ---------------------------------------------------------------------------
// Tool calling behavior
// ---------------------------------------------------------------------------

Deno.test("TestModel - calls regular tools on turn 1", async () => {
  let toolCallCount = 0;

  const myTool = tool({
    name: "my_tool",
    description: "A test tool",
    parameters: z.object({ input: z.string() }),
    // deno-lint-ignore require-await
    execute: async (_ctx, args) => {
      toolCallCount++;
      return `echo: ${args.input}`;
    },
  });

  const model = new TestModel();
  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("Use the tool");

  assertEquals(toolCallCount, 1);
});

Deno.test("TestModel - skips tool calls when callTools=false", async () => {
  let toolCallCount = 0;

  const myTool = tool({
    name: "my_tool",
    description: "A test tool",
    parameters: z.object({ input: z.string() }),
    // deno-lint-ignore require-await
    execute: async () => {
      toolCallCount++;
      return "called";
    },
  });

  const model = new TestModel({ callTools: false });
  const agent = new Agent({ model, tools: [myTool] });
  await agent.run("Use the tool");

  assertEquals(toolCallCount, 0);
});

Deno.test("TestModel - calls multiple tools on turn 1", async () => {
  const calledTools: string[] = [];

  const toolA = tool({
    name: "tool_a",
    description: "Tool A",
    parameters: z.object({ x: z.string() }),
    // deno-lint-ignore require-await
    execute: async () => {
      calledTools.push("a");
      return "a result";
    },
  });

  const toolB = tool({
    name: "tool_b",
    description: "Tool B",
    parameters: z.object({ y: z.number() }),
    // deno-lint-ignore require-await
    execute: async () => {
      calledTools.push("b");
      return "b result";
    },
  });

  const model = new TestModel();
  const agent = new Agent({ model, tools: [toolA, toolB] });
  await agent.run("Use both tools");

  assertEquals(calledTools.includes("a"), true);
  assertEquals(calledTools.includes("b"), true);
});

// ---------------------------------------------------------------------------
// createTestModel with Zod schema
// ---------------------------------------------------------------------------

Deno.test("createTestModel - uses Zod schema for final_result", async () => {
  const OutputSchema = z.object({
    status: z.enum(["active", "inactive"]),
    count: z.number(),
  });

  const model = createTestModel({
    callTools: false,
    outputSchema: OutputSchema,
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });

  const result = await agent.run("Get status");
  assertEquals(["active", "inactive"].includes(result.output.status), true);
  assertEquals(typeof result.output.count, "number");
});

Deno.test("createTestModel - literal schema value", async () => {
  const OutputSchema = z.object({
    kind: z.literal("report"),
    value: z.number(),
  });

  const model = createTestModel({
    callTools: false,
    outputSchema: OutputSchema,
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });

  const result = await agent.run("Get report");
  assertEquals(result.output.kind, "report");
});

// ---------------------------------------------------------------------------
// agent.override integration
// ---------------------------------------------------------------------------

Deno.test("TestModel - works with agent.override", async () => {
  const OutputSchema = z.object({ answer: z.string() });
  const realModel = new TestModel(); // would normally be a real API model
  const testModel = new TestModel({ callTools: false });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model: realModel,
    outputSchema: OutputSchema,
  });

  const result = await agent.override({ model: testModel }).run(
    "What is the answer?",
  );
  assertEquals(typeof result.output.answer, "string");
});

// ---------------------------------------------------------------------------
// Usage is tracked
// ---------------------------------------------------------------------------

Deno.test("TestModel - usage is tracked", async () => {
  const model = new TestModel({ text: "done" });
  const agent = new Agent({ model });
  const result = await agent.run("Hello");
  assertEquals(result.usage.requests, 1);
  assertEquals(result.usage.inputTokens > 0, true);
  assertEquals(result.usage.outputTokens > 0, true);
});
