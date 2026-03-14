/**
 * Tests for streaming partial output (3.4):
 * - partialOutput field on StreamResult
 * - Emits partial objects as final_result tool args stream in
 * - Best-effort (only emits when parse succeeds)
 */
import { assertEquals, assertExists } from "@std/assert";
import { z } from "zod";
import { Agent } from "../mod.ts";
import {
  convertArrayToReadableStream,
  MockLanguageModelV3,
  textStream,
} from "./_helpers.ts";

const OutputSchema = z.object({ name: z.string(), value: z.number() });

Deno.test("StreamResult - has partialOutput field", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hello")),
  });

  const agent = new Agent({ model });
  const result = agent.stream("go");

  assertExists(result.partialOutput);
  // Drain to avoid unhandled promise rejections
  await result.output.catch(() => {});
});

Deno.test("StreamResult - partialOutput is AsyncIterable", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hello")),
  });

  const agent = new Agent({ model });
  const result = agent.stream("go");

  // Should be iterable
  const partials: unknown[] = [];
  for await (const partial of result.partialOutput) {
    partials.push(partial);
  }
  // No partial output for plain text agent
  assertEquals(Array.isArray(partials), true);
});

Deno.test("StreamResult - partialOutput emits nothing for text-only agents", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("hello world")),
  });

  const agent = new Agent({ model });
  const result = agent.stream("go");

  const partials: unknown[] = [];
  for await (const partial of result.partialOutput) {
    partials.push(partial);
  }

  assertEquals(partials.length, 0);
  const output = await result.output;
  assertEquals(output, "hello world");
});

Deno.test("StreamResult - partialOutput streams partial tool args", async () => {
  // Simulate streaming a final_result tool call with incrementally arriving args
  const model = new MockLanguageModelV3({
    doStream: () =>
      Promise.resolve({
        stream: convertArrayToReadableStream([
          {
            type: "tool-input-start" as const,
            id: "tc1",
            toolName: "final_result",
            providerExecuted: false,
          },
          {
            type: "tool-input-delta" as const,
            id: "tc1",
            delta: '{"name":"Al',
          },
          {
            type: "tool-input-delta" as const,
            id: "tc1",
            delta: 'ice","value":',
          },
          {
            type: "tool-input-delta" as const,
            id: "tc1",
            delta: "42}",
          },
          {
            type: "tool-call" as const,
            toolCallId: "tc1",
            toolName: "final_result",
            input: JSON.stringify({ name: "Alice", value: 42 }),
          },
          {
            type: "tool-result" as const,
            toolCallId: "tc1",
            toolName: "final_result",
            result: { name: "Alice", value: 42 },
          },
          {
            type: "finish" as const,
            finishReason: { unified: "tool-calls" as const, raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: 0,
                cacheWrite: undefined,
              },
              outputTokens: { total: 5, text: undefined, reasoning: undefined },
            },
          },
        ]),
      }),
  });

  type Output = z.infer<typeof OutputSchema>;

  const agent = new Agent<undefined, Output>({
    model,
    outputSchema: OutputSchema,
  });

  const result = agent.stream("give me data");
  const partials: Output[] = [];
  for await (const partial of result.partialOutput) {
    partials.push(partial as Output);
  }

  // Should have emitted at least the final complete object
  assertEquals(partials.length > 0, true);
  const lastPartial = partials[partials.length - 1];
  assertEquals(lastPartial.name, "Alice");
  assertEquals(lastPartial.value, 42);

  // Final output should also resolve correctly
  const output = await result.output;
  assertEquals(output.name, "Alice");
  assertEquals(output.value, 42);
});

Deno.test("StreamResult - partialOutput best-effort: skips incomplete JSON", async () => {
  // Only the last delta completes the JSON - partial deltas should be skipped
  const model = new MockLanguageModelV3({
    doStream: () =>
      Promise.resolve({
        stream: convertArrayToReadableStream([
          {
            type: "tool-input-start" as const,
            id: "tc1",
            toolName: "final_result",
            providerExecuted: false,
          },
          {
            type: "tool-input-delta" as const,
            id: "tc1",
            delta: "{",
          },
          {
            type: "tool-input-delta" as const,
            id: "tc1",
            delta: '"name":"Bob","value":99}',
          },
          {
            type: "tool-call" as const,
            toolCallId: "tc1",
            toolName: "final_result",
            input: JSON.stringify({ name: "Bob", value: 99 }),
          },
          {
            type: "tool-result" as const,
            toolCallId: "tc1",
            toolName: "final_result",
            result: { name: "Bob", value: 99 },
          },
          {
            type: "finish" as const,
            finishReason: { unified: "tool-calls" as const, raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: 0,
                cacheWrite: undefined,
              },
              outputTokens: { total: 5, text: undefined, reasoning: undefined },
            },
          },
        ]),
      }),
  });

  type Output = z.infer<typeof OutputSchema>;

  const agent = new Agent<undefined, Output>({
    model,
    outputSchema: OutputSchema,
  });

  const result = agent.stream("give me data");
  const partials: Output[] = [];
  for await (const partial of result.partialOutput) {
    partials.push(partial as Output);
  }

  // The first delta ("{") is not valid JSON, should be skipped
  // The second combined delta creates valid JSON
  assertEquals(partials.length > 0, true);
  const lastPartial = partials[partials.length - 1];
  assertEquals(lastPartial.name, "Bob");
});
