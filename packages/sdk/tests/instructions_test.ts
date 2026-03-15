/**
 * Tests for the instructions feature (1.4).
 * Verifies that instructions are injected per-turn into the system prompt
 * but are not stored in result.messages / result.newMessages.
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { Agent } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// Helper to extract the system message text from a doGenerate call
function captureSystem(
  opts: { prompt: Array<{ role: string; content: unknown }> },
): string | undefined {
  const sys = opts.prompt.find((m) => m.role === "system");
  if (!sys) return undefined;
  return typeof sys.content === "string" ? sys.content : undefined;
}

Deno.test("instructions - static string is injected into system prompt", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    instructions: "Always be concise.",
  });

  await agent.run("prompt");

  assertEquals(capturedSystem, "Always be concise.");
});

Deno.test("instructions - combined with systemPrompt using double newline", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    systemPrompt: "You are a helpful assistant.",
    instructions: "Always respond in JSON.",
  });

  await agent.run("prompt");

  assertStringIncludes(capturedSystem ?? "", "You are a helpful assistant.");
  assertStringIncludes(capturedSystem ?? "", "Always respond in JSON.");
});

Deno.test("instructions - dynamic function is resolved per-turn", async () => {
  let turnCount = 0;
  const capturedSystems: (string | undefined)[] = [];

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("noop", {}),
    textResponse("done"),
  );

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystems.push(
        captureSystem(
          opts as { prompt: Array<{ role: string; content: unknown }> },
        ),
      );
      return Promise.resolve(responses());
    },
  });

  const noopTool = {
    name: "noop",
    description: "no-op tool",
    parameters: (await import("zod")).z.object({}),
    execute: () => Promise.resolve("ok"),
  };

  const agent = new Agent({
    model,
    tools: [noopTool],
    instructions: (_ctx) => {
      turnCount++;
      return `Turn ${turnCount} instruction`;
    },
  });

  await agent.run("go");

  // Instructions are resolved on each turn
  assertEquals(capturedSystems.length, 2);
  assertStringIncludes(capturedSystems[0] ?? "", "Turn 1");
  assertStringIncludes(capturedSystems[1] ?? "", "Turn 2");
});

Deno.test("instructions - not stored in result.messages", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: textResponse("response text"),
  });

  const agent = new Agent({
    model,
    instructions: "SECRET INSTRUCTION",
  });

  const result = await agent.run("prompt");

  // Instructions should NOT appear in any message in result.messages
  const allContent = result.messages
    .flatMap((m) => {
      if (typeof m.content === "string") return [m.content];
      if (Array.isArray(m.content)) {
        return m.content.map((c) =>
          typeof c === "object" && c !== null && "text" in c
            ? String((c as { text: unknown }).text)
            : ""
        );
      }
      return [];
    })
    .join(" ");

  assertEquals(allContent.includes("SECRET INSTRUCTION"), false);
});

Deno.test("instructions - not stored in result.newMessages", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: textResponse("response text"),
  });

  const agent = new Agent({
    model,
    instructions: "DO NOT STORE ME",
  });

  const result = await agent.run("prompt");

  const allContent = result.newMessages
    .flatMap((m) => {
      if (typeof m.content === "string") return [m.content];
      if (Array.isArray(m.content)) {
        return m.content.map((c) =>
          typeof c === "object" && c !== null && "text" in c
            ? String((c as { text: unknown }).text)
            : ""
        );
      }
      return [];
    })
    .join(" ");

  assertEquals(allContent.includes("DO NOT STORE ME"), false);
});

Deno.test("instructions - array of strings and functions", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    instructions: "First instruction.",
  });
  agent.addInstruction(() => Promise.resolve("Second instruction."));

  await agent.run("prompt");

  assertStringIncludes(capturedSystem ?? "", "First instruction.");
  assertStringIncludes(capturedSystem ?? "", "Second instruction.");
});

Deno.test("instructions - override() can set instructions", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    instructions: "original instruction",
  });

  await agent.override({ instructions: "overridden instruction" }).run("hi");
  assertEquals(capturedSystem, "overridden instruction");
});

Deno.test("instructions - addInstruction appends to existing instructions", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    instructions: "first",
  });
  agent.addInstruction("second");

  await agent.run("go");
  assertStringIncludes(capturedSystem ?? "", "first");
  assertStringIncludes(capturedSystem ?? "", "second");
});

Deno.test("instructions - systemPrompt without instructions uses only systemPrompt", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    systemPrompt: "only system",
  });

  await agent.run("go");
  assertEquals(capturedSystem, "only system");
});
