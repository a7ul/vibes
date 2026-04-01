/**
 * Tests for Toolset.getInstructions (pydantic-ai v1.74.0 port).
 * Verifies that FunctionToolset instructions and custom Toolset.getInstructions
 * are injected per-turn into the system prompt but not stored in messages.
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { Agent, FunctionToolset, tool, type Toolset } from "../mod.ts";
import { z } from "zod";
import {
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
  type DoGenerateResult,
} from "./_helpers.ts";

function captureSystem(
  opts: { prompt: Array<{ role: string; content: unknown }> },
): string | undefined {
  const sys = opts.prompt.find((m) => m.role === "system");
  if (!sys) return undefined;
  return typeof sys.content === "string" ? sys.content : undefined;
}

const noopTool = tool({
  name: "noop",
  description: "no-op tool",
  parameters: z.object({}),
  execute: () => Promise.resolve("ok"),
});

Deno.test("FunctionToolset - static string instructions injected into system", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("done"));
    },
  });

  const ts = new FunctionToolset([], {
    instructions: "Always use the search tool first.",
  });
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("go");

  assertStringIncludes(
    capturedSystem ?? "",
    "Always use the search tool first.",
  );
});

Deno.test("FunctionToolset - instructions combined with agent instructions", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("done"));
    },
  });

  const ts = new FunctionToolset([], {
    instructions: "Toolset instruction.",
  });
  const agent = new Agent({
    model,
    instructions: "Agent instruction.",
    toolsets: [ts],
  });
  await agent.run("go");

  assertStringIncludes(capturedSystem ?? "", "Agent instruction.");
  assertStringIncludes(capturedSystem ?? "", "Toolset instruction.");
});

Deno.test("FunctionToolset - dynamic function instructions resolved per-turn", async () => {
  let turnCount = 0;
  const capturedSystems: string[] = [];

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("noop", {}),
    textResponse("done"),
  );

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      const sys = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      if (sys) capturedSystems.push(sys);
      return Promise.resolve(responses());
    },
  });

  const ts = new FunctionToolset([noopTool], {
    instructions: (_ctx) => {
      turnCount++;
      return `Turn ${turnCount} toolset instruction`;
    },
  });
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("go");

  assertEquals(capturedSystems.length, 2);
  assertStringIncludes(capturedSystems[0], "Turn 1");
  assertStringIncludes(capturedSystems[1], "Turn 2");
});

Deno.test("FunctionToolset - array of instructions", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("done"));
    },
  });

  const ts = new FunctionToolset([], {
    instructions: ["First rule.", "Second rule."],
  });
  const agent = new Agent({ model, toolsets: [ts] });
  await agent.run("go");

  assertStringIncludes(capturedSystem ?? "", "First rule.");
  assertStringIncludes(capturedSystem ?? "", "Second rule.");
});

Deno.test("Toolset.getInstructions - custom interface implementation", async () => {
  let capturedSystem: string | undefined;

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedSystem = captureSystem(
        opts as { prompt: Array<{ role: string; content: unknown }> },
      );
      return Promise.resolve(textResponse("done"));
    },
  });

  const customTs: Toolset = {
    tools: () => [],
    getInstructions: (_ctx) => "Custom toolset instructions.",
  };

  const agent = new Agent({ model, toolsets: [customTs] });
  await agent.run("go");

  assertStringIncludes(capturedSystem ?? "", "Custom toolset instructions.");
});

Deno.test("FunctionToolset - instructions not stored in result.messages", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: textResponse("done"),
  });

  const ts = new FunctionToolset([], {
    instructions: "SECRET TOOLSET INSTRUCTION",
  });
  const agent = new Agent({ model, toolsets: [ts] });
  const result = await agent.run("go");

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

  assertEquals(allContent.includes("SECRET TOOLSET INSTRUCTION"), false);
});

Deno.test("FunctionToolset - no instructions returns null from getInstructions", async () => {
  const ts = new FunctionToolset([]);
  const result = await ts.getInstructions({} as import("../mod.ts").RunContext);
  assertEquals(result, null);
});
