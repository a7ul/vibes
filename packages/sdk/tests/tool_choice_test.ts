/**
 * Tests for the toolChoice setting in ModelSettings (ported from pydantic-ai v1.93.0).
 *
 * toolChoice controls which function tools the model can use:
 * - 'auto': model decides (default)
 * - 'none': no function tools; output/final_result tools still available
 * - 'required': model must call a tool
 * - string[]: only listed function tools + output/final_result tools available
 *
 * Note: The AI SDK passes toolChoice to the model provider as { type: 'required' },
 * { type: 'none' }, etc. (an object, not a string). Tools are passed as an array of
 * { type: 'function', name: string, ... } objects.
 */
import { assertEquals, assertExists } from "@std/assert";
import { z } from "zod";
import { Agent, tool, outputTool } from "../mod.ts";
import type { ToolChoice } from "../mod.ts";
import {
  MockLanguageModelV3,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

/** AI SDK passes toolChoice to the provider as { type: '...' }, not as a plain string. */
type ProviderToolChoice =
  | { type: "auto" }
  | { type: "none" }
  | { type: "required" }
  | { type: "tool"; toolName: string };

/** AI SDK passes tools to the provider as an array of function descriptors. */
type ProviderTool = { type: string; name: string };

// ---------------------------------------------------------------------------
// toolChoice: 'auto'
// ---------------------------------------------------------------------------

Deno.test("toolChoice - 'auto' does not set toolChoice on model", async () => {
  let capturedToolChoice: unknown;
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedToolChoice = (opts as Record<string, unknown>).toolChoice;
      return Promise.resolve(textResponse("ok"));
    },
  });

  const agent = new Agent({
    model,
    modelSettings: { toolChoice: "auto" },
  });

  await agent.run("prompt");
  // 'auto' is the default - we omit toolChoice so the AI SDK uses its default behavior
  assertEquals(capturedToolChoice, undefined);
});

// ---------------------------------------------------------------------------
// toolChoice: 'required'
// ---------------------------------------------------------------------------

Deno.test(
  "toolChoice - 'required' passes { type: 'required' } to model",
  async () => {
    let capturedToolChoice: ProviderToolChoice | undefined;

    const echoTool = tool({
      name: "echo",
      description: "Echo",
      parameters: z.object({ msg: z.string() }),
      execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
    });

    let turn = 0;
    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedToolChoice = (opts as Record<string, unknown>)
          .toolChoice as ProviderToolChoice | undefined;
        turn++;
        if (turn === 1) {
          return Promise.resolve(
            toolCallResponse("echo", { msg: "hi" }),
          );
        }
        return Promise.resolve(textResponse("done"));
      },
    });

    const agent = new Agent({
      model,
      tools: [echoTool],
      modelSettings: { toolChoice: "required" },
    });

    await agent.run("prompt");
    assertExists(capturedToolChoice);
    assertEquals(capturedToolChoice.type, "required");
  },
);

// ---------------------------------------------------------------------------
// toolChoice: 'none' - function tools filtered out, output tools kept
// ---------------------------------------------------------------------------

Deno.test(
  "toolChoice - 'none' removes function tools from tool map (no output schema)",
  async () => {
    let capturedTools: ProviderTool[] | undefined;

    const echoTool = tool({
      name: "echo",
      description: "Echo",
      parameters: z.object({ msg: z.string() }),
      execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
    });

    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedTools = (opts as Record<string, unknown>).tools as
          | ProviderTool[]
          | undefined;
        return Promise.resolve(textResponse("result text"));
      },
    });

    const agent = new Agent({
      model,
      tools: [echoTool],
      modelSettings: { toolChoice: "none" },
    });

    await agent.run("prompt");

    // With toolChoice: 'none' and no output schema, the tool map is empty -> undefined
    assertEquals(capturedTools, undefined);
  },
);

Deno.test(
  "toolChoice - 'none' keeps final_result tool, removes function tools",
  async () => {
    const OutputSchema = z.object({ value: z.number() });
    let capturedTools: ProviderTool[] | undefined;

    const echoTool = tool({
      name: "echo",
      description: "Echo",
      parameters: z.object({ msg: z.string() }),
      execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
    });

    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedTools = (opts as Record<string, unknown>).tools as
          | ProviderTool[]
          | undefined;
        return Promise.resolve(
          toolCallResponse("final_result", { value: 42 }),
        );
      },
    });

    type Output = z.infer<typeof OutputSchema>;

    const agent = new Agent<undefined, Output>({
      model,
      tools: [echoTool],
      outputSchema: OutputSchema,
      modelSettings: { toolChoice: "none" },
    });

    const result = await agent.run("prompt");

    // final_result should still be present; echo should be filtered out
    assertExists(capturedTools);
    const names = (capturedTools as ProviderTool[]).map((t) => t.name);
    assertEquals(names.includes("final_result"), true);
    assertEquals(names.includes("echo"), false);
    assertEquals(result.output.value, 42);
  },
);

Deno.test(
  "toolChoice - 'none' keeps outputTool() in tool map, removes function tools",
  async () => {
    let capturedTools: ProviderTool[] | undefined;

    const echoTool = tool({
      name: "echo",
      description: "Echo",
      parameters: z.object({ msg: z.string() }),
      execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
    });

    const submitTool = outputTool({
      name: "submit",
      description: "Submit result",
      parameters: z.object({ answer: z.string() }),
      execute: (_ctx, args: { answer: string }) => Promise.resolve(args.answer),
    });

    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedTools = (opts as Record<string, unknown>).tools as
          | ProviderTool[]
          | undefined;
        return Promise.resolve(toolCallResponse("submit", { answer: "42" }));
      },
    });

    const agent = new Agent({
      model,
      tools: [echoTool, submitTool],
      modelSettings: { toolChoice: "none" },
    });

    const result = await agent.run("prompt");

    assertExists(capturedTools);
    const names = (capturedTools as ProviderTool[]).map((t) => t.name);
    assertEquals(names.includes("echo"), false);
    assertEquals(names.includes("submit"), true);
    assertEquals(result.output, "42");
  },
);

// ---------------------------------------------------------------------------
// toolChoice: string[] - restrict to listed tools
// ---------------------------------------------------------------------------

Deno.test(
  "toolChoice - string[] restricts to listed function tools only",
  async () => {
    let capturedTools: ProviderTool[] | undefined;

    const searchTool = tool({
      name: "search",
      description: "Search",
      parameters: z.object({ q: z.string() }),
      execute: (_ctx, args: { q: string }) => Promise.resolve("result:" + args.q),
    });

    const calcTool = tool({
      name: "calculator",
      description: "Calculate",
      parameters: z.object({ expr: z.string() }),
      execute: (_ctx, args: { expr: string }) => Promise.resolve(args.expr),
    });

    let turn = 0;
    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedTools = (opts as Record<string, unknown>).tools as
          | ProviderTool[]
          | undefined;
        turn++;
        if (turn === 1) {
          return Promise.resolve(toolCallResponse("search", { q: "hello" }));
        }
        return Promise.resolve(textResponse("done"));
      },
    });

    const agent = new Agent({
      model,
      tools: [searchTool, calcTool],
      modelSettings: { toolChoice: ["search"] },
    });

    await agent.run("prompt");

    // Only 'search' in tool map; 'calculator' filtered out
    assertExists(capturedTools);
    const names = (capturedTools as ProviderTool[]).map((t) => t.name);
    assertEquals(names.includes("search"), true);
    assertEquals(names.includes("calculator"), false);
  },
);

Deno.test(
  "toolChoice - string[] passes { type: 'required' } to model when tools match",
  async () => {
    let capturedToolChoice: ProviderToolChoice | undefined;

    const searchTool = tool({
      name: "search",
      description: "Search",
      parameters: z.object({ q: z.string() }),
      execute: (_ctx, args: { q: string }) => Promise.resolve("result:" + args.q),
    });

    let turn = 0;
    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedToolChoice = (opts as Record<string, unknown>)
          .toolChoice as ProviderToolChoice | undefined;
        turn++;
        if (turn === 1) {
          return Promise.resolve(toolCallResponse("search", { q: "test" }));
        }
        return Promise.resolve(textResponse("done"));
      },
    });

    const agent = new Agent({
      model,
      tools: [searchTool],
      modelSettings: { toolChoice: ["search"] },
    });

    await agent.run("prompt");
    assertExists(capturedToolChoice);
    assertEquals(capturedToolChoice.type, "required");
  },
);

Deno.test(
  "toolChoice - string[] keeps final_result tool alongside listed tools",
  async () => {
    const OutputSchema = z.object({ value: z.number() });
    let capturedTools: ProviderTool[] | undefined;

    const searchTool = tool({
      name: "search",
      description: "Search",
      parameters: z.object({ q: z.string() }),
      execute: (_ctx, args: { q: string }) => Promise.resolve("result:" + args.q),
    });

    const calcTool = tool({
      name: "calculator",
      description: "Calculate",
      parameters: z.object({ expr: z.string() }),
      execute: (_ctx, args: { expr: string }) => Promise.resolve(args.expr),
    });

    type Output = z.infer<typeof OutputSchema>;

    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedTools = (opts as Record<string, unknown>).tools as
          | ProviderTool[]
          | undefined;
        return Promise.resolve(toolCallResponse("final_result", { value: 99 }));
      },
    });

    const agent = new Agent<undefined, Output>({
      model,
      tools: [searchTool, calcTool],
      outputSchema: OutputSchema,
      modelSettings: { toolChoice: ["search"] },
    });

    const result = await agent.run("prompt");

    assertExists(capturedTools);
    const names = (capturedTools as ProviderTool[]).map((t) => t.name);
    assertEquals(names.includes("search"), true);
    assertEquals(names.includes("calculator"), false);
    assertEquals(names.includes("final_result"), true);
    assertEquals(result.output.value, 99);
  },
);

// ---------------------------------------------------------------------------
// toolChoice inheritance and override
// ---------------------------------------------------------------------------

Deno.test(
  "toolChoice - per-run modelSettings overrides agent-level",
  async () => {
    let capturedToolChoice: ProviderToolChoice | undefined;

    const model = new MockLanguageModelV3({
      doGenerate: (opts) => {
        capturedToolChoice = (opts as Record<string, unknown>)
          .toolChoice as ProviderToolChoice | undefined;
        return Promise.resolve(textResponse("ok"));
      },
    });

    const agent = new Agent({
      model,
      modelSettings: { toolChoice: "required" },
    });

    // Per-run 'auto' should override agent-level 'required'
    await agent.run("prompt", { modelSettings: { toolChoice: "auto" } });

    // 'auto' means we omit toolChoice entirely
    assertEquals(capturedToolChoice, undefined);
  },
);

Deno.test("toolChoice - ToolChoice type is exported from mod.ts", () => {
  const choice: ToolChoice = "auto";
  assertEquals(choice, "auto");

  const choice2: ToolChoice = "none";
  assertEquals(choice2, "none");

  const choice3: ToolChoice = "required";
  assertEquals(choice3, "required");

  const choice4: ToolChoice = ["tool1", "tool2"];
  assertEquals(choice4, ["tool1", "tool2"]);
});
