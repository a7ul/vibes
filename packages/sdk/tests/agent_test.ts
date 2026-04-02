import { assertEquals, assertExists } from "@std/assert";
import { Agent, type RunContext, tool } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("Agent - basic text run", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: textResponse("hello world"),
  });

  const agent = new Agent({ model, systemPrompt: "Be concise." });
  const result = await agent.run("Say exactly: hello world");

  assertEquals(result.output, "hello world");
  assertExists(result.runId);
  assertEquals(result.usage.requests, 1);
  assertEquals(result.messages.length, 2); // user + assistant
});

Deno.test("Agent - structured output with Zod schema", async () => {
  const OutputSchema = z.object({ name: z.string(), capital: z.string() });

  const model = new MockLanguageModelV3({
    doGenerate: toolCallResponse("final_result", {
      name: "France",
      capital: "Paris",
    }),
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });

  const result = await agent.run("Capital of France?");
  assertEquals(result.output.name, "France");
  assertEquals(result.output.capital, "Paris");
});

Deno.test("Agent - tool with deps injection", async () => {
  type Deps = { greeting: string };

  const greetTool = tool<Deps>({
    name: "get_greeting",
    description: "Get the configured greeting",
    parameters: z.object({}),
    execute: (ctx: RunContext<Deps>) => Promise.resolve(ctx.deps.greeting),
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("get_greeting", {}),
    textResponse("The greeting is: Buenos días!"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });
  const agent = new Agent<Deps>({ model, tools: [greetTool] });

  const result = await agent.run("What is the greeting?", {
    deps: { greeting: "Buenos días!" },
  });

  assertEquals(result.output.toLowerCase().includes("buenos"), true);
  assertEquals(result.usage.requests, 2);
});

Deno.test("Agent - message history passthrough", async () => {
  const responses = mockValues<DoGenerateResult>(
    textResponse("Nice to meet you, TestUser123."),
    textResponse("Your name is TestUser123."),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });
  const agent = new Agent({ model });

  const first = await agent.run("My name is TestUser123.");
  const second = await agent.run("What is my name?", {
    messageHistory: first.messages,
  });

  assertEquals(second.output.includes("TestUser123"), true);
  assertEquals(second.messages.length >= 4, true);
});

Deno.test("Agent - result validator accepts valid output", async () => {
  const OutputSchema = z.object({ score: z.number() });
  type Output = z.infer<typeof OutputSchema>;

  const model = new MockLanguageModelV3({
    doGenerate: toolCallResponse("final_result", { score: 7 }),
  });

  const agent = new Agent<undefined, Output>({
    model,
    outputSchema: OutputSchema,
    resultValidators: [
      (_ctx: RunContext<undefined>, output: Output): Output => {
        if (output.score < 1 || output.score > 10) {
          throw new Error("Out of range");
        }
        return output;
      },
    ],
  });

  const result = await agent.run("Give me a score.");
  assertEquals(result.output.score, 7);
});

Deno.test("Agent - result validator rejects then retries", async () => {
  const OutputSchema = z.object({ score: z.number() });
  type Output = z.infer<typeof OutputSchema>;

  const doGenerate = mockValues<DoGenerateResult>(
    toolCallResponse("final_result", { score: 0 }, "tc1"),
    toolCallResponse("final_result", { score: 5 }, "tc2"),
  );

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(doGenerate()),
  });

  const agent = new Agent<undefined, Output>({
    model,
    outputSchema: OutputSchema,
    resultValidators: [
      (_ctx: RunContext<undefined>, output: Output): Output => {
        if (output.score < 1) throw new Error("Score too low");
        return output;
      },
    ],
  });

  const result = await agent.run("Give me a score.");
  assertEquals(result.output.score, 5);
  assertEquals(result.retryCount, 1);
});

Deno.test("Agent - dynamic system prompt receives RunContext deps", async () => {
  type Deps = { username: string };
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      const sysMsg = opts.prompt.find(
        (m: { role: string }) => m.role === "system",
      );
      capturedSystem = typeof sysMsg?.content === "string"
        ? sysMsg.content
        : undefined;
      return Promise.resolve(textResponse("Hello!"));
    },
  });

  const agent = new Agent<Deps>({
    model,
    systemPrompt: (ctx: RunContext<Deps>) => `Greet user: ${ctx.deps.username}`,
  });

  await agent.run("Hi", { deps: { username: "Alice" } });
  assertEquals(capturedSystem?.includes("Alice"), true);
});

Deno.test("Agent - RunContext.agent references the running agent", async () => {
  let capturedAgent: Agent<undefined> | undefined;

  const captureTool = tool({
    name: "capture",
    description: "Captures the agent from RunContext",
    parameters: z.object({}),
    execute: (ctx: RunContext<undefined>) => {
      capturedAgent = ctx.agent as Agent<undefined>;
      return Promise.resolve("captured");
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("capture", {}),
    textResponse("done"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });
  const agent = new Agent({ model, tools: [captureTool], name: "test-agent" });

  await agent.run("Capture the agent.");
  assertEquals(capturedAgent, agent);
});

Deno.test("Agent - tool maxRetries retries on failure", async () => {
  let callCount = 0;

  const flakyTool = tool({
    name: "flaky",
    description: "Fails once then succeeds",
    parameters: z.object({}),
    maxRetries: 1,
    execute: () => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("transient failure"));
      }
      return Promise.resolve("ok");
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

  await agent.run("Use the flaky tool.");
  assertEquals(callCount, 2);
});
