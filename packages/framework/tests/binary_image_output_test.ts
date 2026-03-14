import { assertEquals, assertRejects } from "@std/assert";
import { z } from "zod";
import {
  BINARY_IMAGE_OUTPUT,
  type BinaryContent,
  binaryContentToToolResult,
  extractBinaryImageFromToolOutput,
  isBinaryImageOutput,
} from "../lib/multimodal/binary_content.ts";
import { Agent, tool } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Unit tests for the sentinel and extraction helpers
// ---------------------------------------------------------------------------

Deno.test("BINARY_IMAGE_OUTPUT - is a symbol", () => {
  assertEquals(typeof BINARY_IMAGE_OUTPUT, "symbol");
});

Deno.test("isBinaryImageOutput - returns true for the sentinel", () => {
  assertEquals(isBinaryImageOutput(BINARY_IMAGE_OUTPUT), true);
});

Deno.test("isBinaryImageOutput - returns false for other values", () => {
  assertEquals(isBinaryImageOutput(null), false);
  assertEquals(isBinaryImageOutput(undefined), false);
  assertEquals(isBinaryImageOutput(Symbol("other")), false);
  assertEquals(isBinaryImageOutput(z.string()), false);
  assertEquals(isBinaryImageOutput("BINARY_IMAGE_OUTPUT"), false);
});

Deno.test("extractBinaryImageFromToolOutput - extracts BinaryContent from tool result format", () => {
  const original: BinaryContent = {
    type: "binary",
    mimeType: "image/png",
    data: new Uint8Array([1, 2, 3, 4]),
  };
  // Simulate what binaryContentToToolResult produces
  const toolResult = binaryContentToToolResult(original);

  const extracted = extractBinaryImageFromToolOutput(toolResult);
  assertEquals(extracted !== null, true);
  assertEquals(extracted!.type, "binary");
  assertEquals(extracted!.mimeType, "image/png");
  assertEquals(extracted!.data, original.data);
});

Deno.test("extractBinaryImageFromToolOutput - returns null for non-image output", () => {
  assertEquals(extractBinaryImageFromToolOutput(null), null);
  assertEquals(extractBinaryImageFromToolOutput("text"), null);
  assertEquals(extractBinaryImageFromToolOutput({ type: "text", text: "hi" }), null);
  assertEquals(extractBinaryImageFromToolOutput({ type: "image", image: "no-comma", mimeType: "image/png" }), null);
  assertEquals(
    extractBinaryImageFromToolOutput({
      type: "image",
      image: "data:text/plain;base64,aGVsbG8=",
      mimeType: "text/plain",
    }),
    null,
  );
});

Deno.test("extractBinaryImageFromToolOutput - returns null when image field missing", () => {
  assertEquals(
    extractBinaryImageFromToolOutput({ type: "image", mimeType: "image/png" }),
    null,
  );
});

// ---------------------------------------------------------------------------
// Integration tests: Agent with BINARY_IMAGE_OUTPUT sentinel
// ---------------------------------------------------------------------------

Deno.test("BINARY_IMAGE_OUTPUT - agent returns BinaryContent when tool produces image", async () => {
  const pngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const imageTool = tool({
    name: "generate_image",
    description: "Generate an image",
    parameters: z.object({ prompt: z.string() }),
    // deno-lint-ignore require-await
    execute: async (_ctx, _args): Promise<BinaryContent> => ({
      type: "binary",
      mimeType: "image/png",
      data: pngHeader,
    }),
  });

  // Model calls generate_image, then the agent should extract the image and stop
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("generate_image", { prompt: "a cat" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({
    model,
    tools: [imageTool],
    outputSchema: BINARY_IMAGE_OUTPUT,
  });

  const result = await agent.run("generate a cat image");
  const output = result.output as unknown as BinaryContent;

  assertEquals(output.type, "binary");
  assertEquals(output.mimeType, "image/png");
  assertEquals(output.data, pngHeader);
});

Deno.test("BINARY_IMAGE_OUTPUT - agent continues to next turn if no image tool result yet", async () => {
  const pngHeader = new Uint8Array([137, 80, 78, 71]);

  const searchTool = tool({
    name: "search",
    description: "Search for something",
    parameters: z.object({ query: z.string() }),
    // deno-lint-ignore require-await
    execute: async (_ctx, _args): Promise<string> => "found some results",
  });

  const imageTool = tool({
    name: "generate_image",
    description: "Generate an image",
    parameters: z.object({ prompt: z.string() }),
    // deno-lint-ignore require-await
    execute: async (_ctx, _args): Promise<BinaryContent> => ({
      type: "binary",
      mimeType: "image/jpeg",
      data: pngHeader,
    }),
  });

  // First turn: model calls search (no image), second turn: model calls generate_image
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("search", { query: "cats" }),
    toolCallResponse("generate_image", { prompt: "a cat" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({
    model,
    tools: [searchTool, imageTool],
    outputSchema: BINARY_IMAGE_OUTPUT,
  });

  const result = await agent.run("find and generate a cat image");
  const output = result.output as unknown as BinaryContent;

  assertEquals(output.type, "binary");
  assertEquals(output.mimeType, "image/jpeg");
});

Deno.test("BINARY_IMAGE_OUTPUT - throws MaxTurnsError when no image produced within maxTurns", async () => {
  const { MaxTurnsError } = await import("../lib/types/errors.ts");

  const searchTool = tool({
    name: "search",
    description: "Search",
    parameters: z.object({ query: z.string() }),
    // deno-lint-ignore require-await
    execute: async (_ctx, _args): Promise<string> => "results",
  });

  // Always returns a non-image tool call
  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(toolCallResponse("search", { query: "test" })),
  });

  const agent = new Agent({
    model,
    tools: [searchTool],
    outputSchema: BINARY_IMAGE_OUTPUT,
    maxTurns: 2,
  });

  await assertRejects(
    () => agent.run("search forever"),
    MaxTurnsError,
  );
});

Deno.test("BINARY_IMAGE_OUTPUT - no final_result tool is registered", async () => {
  // With BINARY_IMAGE_OUTPUT, there should be no final_result injected.
  // We verify this by checking the model receives calls WITHOUT a final_result tool.
  const capturedTools: string[][] = [];

  const imageTool = tool({
    name: "make_image",
    description: "Make image",
    parameters: z.object({}),
    // deno-lint-ignore require-await
    execute: async (): Promise<BinaryContent> => ({
      type: "binary",
      mimeType: "image/png",
      data: new Uint8Array([1]),
    }),
  });

  const model = new MockLanguageModelV3({
    doGenerate: (options) => {
      const toolNames = Object.keys(options.tools ?? {});
      capturedTools.push(toolNames);
      return Promise.resolve(toolCallResponse("make_image", {}));
    },
  });

  const agent = new Agent({
    model,
    tools: [imageTool],
    outputSchema: BINARY_IMAGE_OUTPUT,
  });

  await agent.run("make an image");

  // No turn should have a final_result tool in the tool set
  for (const turnTools of capturedTools) {
    assertEquals(
      turnTools.some((t) => t.startsWith("final_result")),
      false,
      `Expected no final_result tool, but got: ${turnTools.join(", ")}`,
    );
  }
});
