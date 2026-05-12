import { assertEquals } from "@std/assert";
import type { ModelMessage } from "ai";
import { Agent } from "../mod.ts";
import { MockLanguageModelV3, textResponse, textStream } from "./_helpers.ts";

function systemMessage(text: string): ModelMessage {
  return { role: "system", content: text };
}

function leadingSystemTexts(
  prompt: Array<{ role: string; content: unknown }>,
): string[] {
  const result: string[] = [];
  for (const message of prompt) {
    if (message.role !== "system") break;
    result.push(typeof message.content === "string" ? message.content : "");
  }
  return result;
}

Deno.test("run merges leading system messages before sending the request", async () => {
  let capturedSystems: string[] = [];

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystems = leadingSystemTexts(
        opts.prompt as Array<{ role: string; content: unknown }>,
      );
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    systemPrompt: "Agent system prompt",
  });

  await agent.run("hello", {
    messageHistory: [
      systemMessage("History system one"),
      systemMessage("History system two"),
    ],
  });

  assertEquals(capturedSystems, [
    "Agent system prompt\n\nHistory system one\n\nHistory system two",
  ]);
});

Deno.test("stream merges leading system messages before sending the request", async () => {
  let capturedSystems: string[] = [];

  const model = new MockLanguageModelV3({
    doStream: (opts) => {
      capturedSystems = leadingSystemTexts(
        opts.prompt as Array<{ role: string; content: unknown }>,
      );
      return Promise.resolve(textStream("ok"));
    },
  });

  const agent = new Agent({ model });
  const stream = agent.stream("hello", {
    messageHistory: [
      systemMessage("History system one"),
      systemMessage("History system two"),
    ],
  });

  for await (const _ of stream.textStream) {
    // drain
  }
  await stream.output;

  assertEquals(capturedSystems, ["History system one\n\nHistory system two"]);
});

Deno.test("runStreamEvents merges leading system messages before sending the request", async () => {
  let capturedSystems: string[] = [];

  const model = new MockLanguageModelV3({
    doStream: (opts) => {
      capturedSystems = leadingSystemTexts(
        opts.prompt as Array<{ role: string; content: unknown }>,
      );
      return Promise.resolve(textStream("ok"));
    },
  });

  const agent = new Agent({ model, systemPrompt: "Agent system prompt" });

  for await (
    const _ of agent.runStreamEvents("hello", {
      messageHistory: [systemMessage("History system")],
    })
  ) {
    // drain
  }

  assertEquals(capturedSystems, ["Agent system prompt\n\nHistory system"]);
});
