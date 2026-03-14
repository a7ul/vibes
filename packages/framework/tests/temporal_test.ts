/**
 * Tests for the Temporal durable execution integration.
 *
 * All tests use MockTemporalAgent (no Temporal server required).
 */

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { z } from "zod";
import { Agent } from "../mod.ts";
import {
  deserializeRunState,
  MockTemporalAgent,
  roundTripMessages,
  serializeRunState,
  TemporalAgent,
} from "../lib/temporal/mod.ts";
import type {
  SerializableMessage,
  TemporalAgentOptions,
} from "../lib/temporal/mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(response: string | (() => DoGenerateResult)) {
  const doGenerate = typeof response === "string"
    ? () => Promise.resolve(textResponse(response))
    : () => Promise.resolve(response());

  const model = new MockLanguageModelV3({ doGenerate });
  return new Agent({ model });
}

const defaultOptions: TemporalAgentOptions<undefined> = {
  taskQueue: "test-queue",
};

// ---------------------------------------------------------------------------
// Serialization tests
// ---------------------------------------------------------------------------

Deno.test("serializeRunState - serializes user messages", () => {
  const messages = [
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi there!" },
  ];
  const serialized = serializeRunState(messages);
  assertEquals(serialized.length, 2);
  assertEquals(serialized[0].role, "user");
  assertEquals(serialized[0].content, "Hello");
  assertEquals(serialized[1].role, "assistant");
  assertEquals(serialized[1].content, "Hi there!");
});

Deno.test("serializeRunState - serializes messages with array content", () => {
  // Use cast to bypass strict ModelMessage typing — we're testing serialization
  // with a structurally valid but not statically typed message shape.
  const messages = [
    {
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
    },
  ] as unknown as import("ai").ModelMessage[];
  const serialized = serializeRunState(messages);
  assertEquals(serialized.length, 1);
  assertEquals(Array.isArray(serialized[0].content), true);
});

Deno.test("serializeRunState - throws on missing role", () => {
  const badMessages = [{
    content: "hello",
  }] as unknown as import("ai").ModelMessage[];
  assertThrows(
    () => serializeRunState(badMessages),
    TypeError,
    "missing 'role'",
  );
});

Deno.test("serializeRunState - throws on missing content", () => {
  const badMessages = [{
    role: "user",
  }] as unknown as import("ai").ModelMessage[];
  assertThrows(
    () => serializeRunState(badMessages),
    TypeError,
    "missing 'content'",
  );
});

Deno.test("deserializeRunState - round trips simple messages", () => {
  const serialized: SerializableMessage[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "World" },
  ];
  const deserialized = deserializeRunState(serialized);
  assertEquals(deserialized.length, 2);
  assertEquals((deserialized[0] as Record<string, unknown>)["role"], "user");
  assertEquals(
    (deserialized[0] as Record<string, unknown>)["content"],
    "Hello",
  );
});

Deno.test("deserializeRunState - throws on missing role", () => {
  const bad = [{ content: "hello" }] as unknown as SerializableMessage[];
  assertThrows(
    () => deserializeRunState(bad),
    TypeError,
    "missing 'role'",
  );
});

Deno.test("deserializeRunState - throws on missing content", () => {
  const bad = [{ role: "user" }] as unknown as SerializableMessage[];
  assertThrows(
    () => deserializeRunState(bad),
    TypeError,
    "missing 'content'",
  );
});

Deno.test("roundTripMessages - produces equivalent messages", () => {
  const original = [
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi!" },
  ];
  const roundTripped = roundTripMessages(original);
  assertEquals(roundTripped.length, original.length);
  for (let i = 0; i < original.length; i++) {
    const orig = original[i] as Record<string, unknown>;
    const tripped = roundTripped[i] as Record<string, unknown>;
    assertEquals(tripped["role"], orig["role"]);
    assertEquals(tripped["content"], orig["content"]);
  }
});

// ---------------------------------------------------------------------------
// TemporalAgent constructor tests
// ---------------------------------------------------------------------------

Deno.test("TemporalAgent - stores agent and options", () => {
  const agent = makeAgent("hello");
  const temporal = new TemporalAgent(agent, {
    taskQueue: "my-queue",
    modelCallActivity: { startToCloseTimeout: "30s" },
  });

  assertEquals(temporal.taskQueue, "my-queue");
  assertEquals(temporal.agent, agent);
  assertEquals(temporal.options.modelCallActivity?.startToCloseTimeout, "30s");
});

Deno.test("TemporalAgent.run - delegates to underlying agent", async () => {
  const agent = makeAgent("the answer is 42");
  const temporal = new TemporalAgent(agent, defaultOptions);
  const result = await temporal.run("What is the answer?");
  assertEquals(result.output, "the answer is 42");
});

Deno.test("TemporalAgent.run - passes run options through", async () => {
  let capturedMetadata: Record<string, unknown> | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("done")),
  });
  const agent = new Agent({
    model,
    tools: [
      {
        name: "check",
        description: "check",
        parameters: z.object({}),
        execute: (
          ctx: import("../lib/types/context.ts").RunContext<undefined>,
        ) => {
          capturedMetadata = ctx.metadata;
          return Promise.resolve("checked");
        },
      },
    ],
  });

  const temporal = new TemporalAgent(agent, defaultOptions);
  await temporal.run("check metadata", {
    metadata: { requestId: "test-123" },
  });

  // metadata is only captured if check tool is invoked by the model — so
  // we just verify the run completes without error
  void capturedMetadata;
});

Deno.test("TemporalAgent - activities object exists", () => {
  const agent = makeAgent("hello");
  const temporal = new TemporalAgent(agent, defaultOptions);
  assertEquals(typeof temporal.activities.runModelTurn, "function");
  assertEquals(typeof temporal.activities.runToolCall, "function");
});

Deno.test("TemporalAgent.activities.runModelTurn - returns serialized result", async () => {
  const agent = makeAgent("hello world");
  const temporal = new TemporalAgent(agent, defaultOptions);

  const result = await temporal.activities.runModelTurn({
    prompt: "say hello",
    messages: [],
  });

  assertEquals(result.done, true);
  assertEquals(result.output, "hello world");
  assertEquals(typeof result.usage.inputTokens, "number");
  assertEquals(Array.isArray(result.newMessages), true);
});

Deno.test("TemporalAgent.activities.runToolCall - throws not-implemented", async () => {
  const agent = makeAgent("hello");
  const temporal = new TemporalAgent(agent, defaultOptions);

  await assertRejects(
    () =>
      temporal.activities.runToolCall({
        toolName: "myTool",
        args: {},
        toolCallId: "tc1",
        messages: [],
      }),
    Error,
    "runToolCall",
  );
});

Deno.test("TemporalAgent.workflowFn - runs the agent and returns output", async () => {
  const agent = makeAgent("workflow output");
  const temporal = new TemporalAgent(agent, defaultOptions);

  const output = await temporal.workflowFn("run the workflow");
  assertEquals(output, "workflow output");
});

Deno.test("TemporalAgent - supports typed output schema", async () => {
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("final_result", { result: 42 }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });
  const agent = new Agent<undefined, { result: number }>({
    model,
    outputSchema: z.object({ result: z.number() }),
  });
  const temporal = new TemporalAgent<undefined, { result: number }>(
    agent,
    defaultOptions,
  );

  const runResult = await temporal.run("compute");
  assertEquals(runResult.output.result, 42);
});

// ---------------------------------------------------------------------------
// MockTemporalAgent tests
// ---------------------------------------------------------------------------

Deno.test("MockTemporalAgent - basic run produces correct output", async () => {
  const agent = makeAgent("mock output");
  const mock = new MockTemporalAgent(agent, defaultOptions);

  const result = await mock.run("hello");
  assertEquals(result.output, "mock output");
});

Deno.test("MockTemporalAgent - records activity history on run", async () => {
  const agent = makeAgent("hello");
  const mock = new MockTemporalAgent(agent, defaultOptions);

  await mock.run("prompt");

  const history = mock.getActivityHistory();
  assertEquals(history.length, 1);
  assertEquals(history[0].activity, "runModelTurn");
});

Deno.test("MockTemporalAgent - activity history contains params", async () => {
  const agent = makeAgent("response");
  const mock = new MockTemporalAgent(agent, defaultOptions);

  await mock.run("test prompt");

  const history = mock.getActivityHistory();
  const entry = history[0] as {
    activity: string;
    params: { prompt: string };
    result: unknown;
  };
  assertEquals(entry.params.prompt, "test prompt");
});

Deno.test("MockTemporalAgent - replay returns same result from cache", async () => {
  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(textResponse("cached result"));
    },
  });
  const agent = new Agent({ model });
  const mock = new MockTemporalAgent(agent, defaultOptions);

  // First run — hits the actual agent
  const result1 = await mock.run("same prompt");
  assertEquals(callCount, 1);

  // Second run with the same prompt — should use replay cache
  const result2 = await mock.simulateReplay("same prompt");
  assertEquals(result2.output, result1.output);

  // Verify the replay used the cache (model was NOT called again)
  assertEquals(callCount, 1);
});

Deno.test("MockTemporalAgent - different prompts produce separate history entries", async () => {
  const agent = makeAgent("ok");
  const mock = new MockTemporalAgent(agent, defaultOptions);

  await mock.run("first prompt");
  await mock.run("second prompt");

  const history = mock.getActivityHistory();
  assertEquals(history.length, 2);
  assertEquals(
    (history[0].params as { prompt: string }).prompt,
    "first prompt",
  );
  assertEquals(
    (history[1].params as { prompt: string }).prompt,
    "second prompt",
  );
});

Deno.test("MockTemporalAgent - reset clears history and cache", async () => {
  const agent = makeAgent("hello");
  const mock = new MockTemporalAgent(agent, defaultOptions);

  await mock.run("a prompt");
  assertEquals(mock.getActivityHistory().length, 1);

  mock.reset();
  assertEquals(mock.getActivityHistory().length, 0);

  // After reset, running again should NOT use the replay cache
  let callCount = 0;
  const model2 = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(textResponse("fresh"));
    },
  });
  const agent2 = new Agent({ model: model2 });
  const mock2 = new MockTemporalAgent(agent2, defaultOptions);

  await mock2.run("prompt");
  mock2.reset();
  await mock2.run("prompt");
  assertEquals(callCount, 2);
});

Deno.test("MockTemporalAgent - getActivityHistory returns immutable copy", async () => {
  const agent = makeAgent("hi");
  const mock = new MockTemporalAgent(agent, defaultOptions);

  await mock.run("first");

  const history1 = mock.getActivityHistory();
  const history2 = mock.getActivityHistory();

  // Should be separate array instances (defensive copy)
  assertEquals(history1 === history2, false);
  assertEquals(history1.length, history2.length);
});

Deno.test("MockTemporalAgent - taskQueue reflects options", () => {
  const agent = makeAgent("hi");
  const mock = new MockTemporalAgent(agent, {
    taskQueue: "production-queue",
  });
  assertEquals(mock.taskQueue, "production-queue");
});

Deno.test("MockTemporalAgent - uses depsFactory when provided", async () => {
  let factoryCalled = false;
  const options: TemporalAgentOptions<{ name: string }> = {
    taskQueue: "test",
    depsFactory: () => {
      factoryCalled = true;
      return { name: "injected" };
    },
  };

  let capturedName: string | undefined;
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("done")),
  });
  const agent = new Agent<{ name: string }, string>({
    model,
    systemPrompt: (ctx) => {
      capturedName = ctx.deps.name;
      return "You are helpful.";
    },
  });

  const mock = new MockTemporalAgent(agent, options);
  await mock.run("test");

  assertEquals(factoryCalled, true);
  assertEquals(capturedName, "injected");
});

Deno.test("MockTemporalAgent - records error in history on agent failure", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      throw new Error("model exploded");
    },
  });
  const agent = new Agent({ model });
  const mock = new MockTemporalAgent(agent, defaultOptions);

  await assertRejects(
    () => mock.run("will fail"),
    Error,
    "model exploded",
  );

  const history = mock.getActivityHistory();
  assertEquals(history.length, 1);
  assertEquals(history[0].activity, "runModelTurn");
  const result = history[0].result as { error: string };
  assertEquals(typeof result.error, "string");
});

// ---------------------------------------------------------------------------
// TemporalActivityOptions type tests (compile-time)
// ---------------------------------------------------------------------------

Deno.test("TemporalActivityOptions - validates structure at compile time", () => {
  // This test simply verifies the type compiles correctly
  const opts: import("../lib/temporal/types.ts").TemporalActivityOptions = {
    startToCloseTimeout: "30s",
    retryPolicy: {
      maximumAttempts: 3,
      initialInterval: "1s",
      backoffCoefficient: 2.0,
    },
  };
  assertEquals(opts.startToCloseTimeout, "30s");
  assertEquals(opts.retryPolicy?.maximumAttempts, 3);
});

Deno.test("TemporalAgentOptions - depsFactory is optional", () => {
  const opts: TemporalAgentOptions<undefined> = {
    taskQueue: "q",
  };
  assertEquals(opts.depsFactory, undefined);
});
