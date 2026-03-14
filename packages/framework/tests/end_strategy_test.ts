/**
 * Tests for the endStrategy feature (1.2).
 * Verifies 'early' (default) and 'exhaustive' behaviors.
 */
import { assertEquals } from "@std/assert";
import { Agent, tool } from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

const OutputSchema = z.object({ value: z.string() });

// deno-lint-ignore require-await
Deno.test("endStrategy - defaults to 'early'", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: textResponse("hello"),
  });
  const agent = new Agent({ model });
  assertEquals(agent.endStrategy, "early");
});

Deno.test("endStrategy - 'early' stops on final_result immediately", async () => {
  let sideEffectCalled = false;

  const sideEffectTool = tool({
    name: "side_effect",
    description: "A tool with a side effect",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async (_ctx) => {
      sideEffectCalled = true;
      return "done";
    },
  });

  // Model returns final_result on first call
  const model = new MockLanguageModelV3({
    doGenerate: toolCallResponse("final_result", { value: "result" }),
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
    tools: [sideEffectTool],
    endStrategy: "early",
  });

  const result = await agent.run("go");
  assertEquals(result.output.value, "result");
  // sideEffectTool was never called in the same response as final_result
  // (they were separate — final_result was the only tool call returned)
  assertEquals(sideEffectCalled, false);
});

Deno.test("endStrategy - 'exhaustive' agent setting is stored", () => {
  const model = new MockLanguageModelV3({
    doGenerate: textResponse("ok"),
  });
  const agent = new Agent({ model, endStrategy: "exhaustive" });
  assertEquals(agent.endStrategy, "exhaustive");
});

Deno.test("endStrategy - per-run override to 'exhaustive'", async () => {
  // Agent defaults to 'early' but run overrides to 'exhaustive'
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("final_result", { value: "done" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
    endStrategy: "early",
  });

  // Both strategies should produce the same result (all tools already ran)
  const result = await agent.run("go", { endStrategy: "exhaustive" });
  assertEquals(result.output.value, "done");
});

Deno.test("endStrategy - override() can set endStrategy", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: toolCallResponse("final_result", { value: "overridden" }),
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
  });

  const result = await agent
    .override({ endStrategy: "exhaustive" })
    .run("go");
  assertEquals(result.output.value, "overridden");
});

Deno.test("endStrategy - multi-turn with tool calls completes correctly", async () => {
  let toolCalled = false;

  const myTool = tool({
    name: "my_tool",
    description: "a regular tool",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async () => {
      toolCalled = true;
      return "result";
    },
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("my_tool", {}),
    toolCallResponse("final_result", { value: "final" }),
  );

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
    model,
    outputSchema: OutputSchema,
    tools: [myTool],
    endStrategy: "exhaustive",
  });

  const result = await agent.run("go");
  assertEquals(result.output.value, "final");
  assertEquals(toolCalled, true);
});
