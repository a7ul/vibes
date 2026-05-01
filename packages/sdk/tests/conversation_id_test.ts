import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { Agent } from "../mod.ts";
import { MockLanguageModelV3, textResponse } from "./_helpers.ts";

Deno.test("conversationId - is auto-generated when not provided", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("hi") });
  const agent = new Agent({ model });

  const result = await agent.run("hello");

  assertExists(result.conversationId);
  // Should be a valid UUID string
  assertEquals(typeof result.conversationId, "string");
  assertEquals(result.conversationId.length > 0, true);
});

Deno.test("conversationId - explicit value is used when provided", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("hi") });
  const agent = new Agent({ model });

  const conversationId = "my-conversation-123";
  const result = await agent.run("hello", { conversationId });

  assertEquals(result.conversationId, conversationId);
});

Deno.test("conversationId - is accessible on RunContext", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("hi") });
  let capturedConversationId: string | undefined;

  const agent = new Agent({
    model,
    systemPrompt: (ctx) => {
      capturedConversationId = ctx.conversationId;
      return "You are helpful.";
    },
  });

  const conversationId = "ctx-conversation-456";
  const result = await agent.run("hello", { conversationId });

  assertEquals(capturedConversationId, conversationId);
  assertEquals(result.conversationId, conversationId);
});

Deno.test("conversationId - different runs get different IDs by default", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("hi") });
  const agent = new Agent({ model });

  const result1 = await agent.run("hello");
  const result2 = await agent.run("hello");

  assertNotEquals(result1.conversationId, result2.conversationId);
});

Deno.test("conversationId - same ID can be reused across runs", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("hi") });
  const agent = new Agent({ model });

  const conversationId = "shared-conversation";
  const result1 = await agent.run("hello", { conversationId });
  const result2 = await agent.run("world", { conversationId });

  assertEquals(result1.conversationId, conversationId);
  assertEquals(result2.conversationId, conversationId);
});

Deno.test("conversationId - exposed on stream result", async () => {
  const model = new MockLanguageModelV3({ doGenerate: textResponse("hi") });
  const agent = new Agent({ model });

  const conversationId = "stream-conversation";
  const streamResult = agent.stream("hello", { conversationId });

  // Consume the stream
  for await (const _chunk of streamResult.textStream) {
    // drain
  }

  const resolvedConversationId = await streamResult.conversationId;
  assertEquals(resolvedConversationId, conversationId);
});
