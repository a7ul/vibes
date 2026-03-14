import { assert, assertEquals } from "@std/assert";
import {
  type BinaryContent,
  binaryContentToBase64,
  binaryContentToToolResult,
  isBinaryContent,
  isMultiModalContent,
  isUploadedFile,
  type UploadedFile,
  uploadedFileToToolResult,
} from "../lib/multimodal/binary_content.ts";
import { Agent, tool } from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Type guard tests
// ---------------------------------------------------------------------------

Deno.test("isBinaryContent - returns true for valid BinaryContent", () => {
  const bc: BinaryContent = {
    type: "binary",
    mimeType: "image/png",
    data: new Uint8Array([1, 2, 3]),
  };
  assert(isBinaryContent(bc));
});

Deno.test("isBinaryContent - returns false for non-BinaryContent objects", () => {
  assertEquals(isBinaryContent(null), false);
  assertEquals(isBinaryContent(undefined), false);
  assertEquals(
    isBinaryContent({ type: "text", mimeType: "text/plain" }),
    false,
  );
  assertEquals(
    isBinaryContent({ type: "binary", mimeType: "image/png" }),
    false,
  ); // missing data
  assertEquals(
    isBinaryContent({ type: "binary", data: new Uint8Array() }),
    false,
  ); // missing mimeType
  assertEquals(isBinaryContent("string"), false);
  assertEquals(isBinaryContent(42), false);
});

Deno.test("isUploadedFile - returns true for valid UploadedFile", () => {
  const uf: UploadedFile = {
    type: "uploaded_file",
    fileId: "file-abc123",
    mimeType: "application/pdf",
  };
  assert(isUploadedFile(uf));
});

Deno.test("isUploadedFile - returns true with optional filename", () => {
  const uf: UploadedFile = {
    type: "uploaded_file",
    fileId: "file-xyz",
    mimeType: "image/jpeg",
    filename: "photo.jpg",
  };
  assert(isUploadedFile(uf));
});

Deno.test("isUploadedFile - returns false for non-UploadedFile objects", () => {
  assertEquals(isUploadedFile(null), false);
  assertEquals(isUploadedFile(undefined), false);
  assertEquals(
    isUploadedFile({ type: "binary", fileId: "x", mimeType: "a" }),
    false,
  );
  assertEquals(isUploadedFile({ type: "uploaded_file", mimeType: "a" }), false); // missing fileId
  assertEquals(isUploadedFile("string"), false);
});

Deno.test("isMultiModalContent - returns true for both BinaryContent and UploadedFile", () => {
  const bc: BinaryContent = {
    type: "binary",
    mimeType: "image/png",
    data: new Uint8Array(),
  };
  const uf: UploadedFile = {
    type: "uploaded_file",
    fileId: "x",
    mimeType: "text/plain",
  };
  assert(isMultiModalContent(bc));
  assert(isMultiModalContent(uf));
  assertEquals(isMultiModalContent({ type: "other" }), false);
});

// ---------------------------------------------------------------------------
// Conversion tests
// ---------------------------------------------------------------------------

Deno.test("binaryContentToBase64 - converts Uint8Array to correct base64", () => {
  // "Hello" in ASCII is 72, 101, 108, 108, 111
  const data = new Uint8Array([72, 101, 108, 108, 111]);
  const bc: BinaryContent = { type: "binary", mimeType: "text/plain", data };
  const b64 = binaryContentToBase64(bc);
  assertEquals(b64, "SGVsbG8="); // base64 of "Hello"
});

Deno.test("binaryContentToBase64 - handles empty data", () => {
  const bc: BinaryContent = {
    type: "binary",
    mimeType: "image/png",
    data: new Uint8Array(),
  };
  const b64 = binaryContentToBase64(bc);
  assertEquals(b64, "");
});

Deno.test("binaryContentToToolResult - returns image content part with data URI", () => {
  const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
  const bc: BinaryContent = { type: "binary", mimeType: "image/png", data };
  const part = binaryContentToToolResult(bc);
  assertEquals(part.type, "image");
  assertEquals(part.mimeType, "image/png");
  assertEquals(part.image, "data:image/png;base64,SGVsbG8=");
});

Deno.test("uploadedFileToToolResult - returns text content part with file reference", () => {
  const uf: UploadedFile = {
    type: "uploaded_file",
    fileId: "file-abc",
    mimeType: "application/pdf",
  };
  const part = uploadedFileToToolResult(uf);
  assertEquals(part.type, "text");
  assertEquals(part.text, "[file:file-abc mime=application/pdf]");
});

Deno.test("uploadedFileToToolResult - includes filename when present", () => {
  const uf: UploadedFile = {
    type: "uploaded_file",
    fileId: "file-xyz",
    mimeType: "image/jpeg",
    filename: "photo.jpg",
  };
  const part = uploadedFileToToolResult(uf);
  assertEquals(part.type, "text");
  assertEquals(part.text, "[file:file-xyz (photo.jpg) mime=image/jpeg]");
});

// ---------------------------------------------------------------------------
// Integration tests — tools returning BinaryContent and UploadedFile
// ---------------------------------------------------------------------------

Deno.test("BinaryContent - tool can return BinaryContent without error", async () => {
  const imgTool = tool({
    name: "get_image",
    description: "Get an image",
    parameters: z.object({}),
    execute: (): Promise<
      import("../lib/multimodal/binary_content.ts").BinaryContent
    > => Promise.resolve({
      type: "binary",
      mimeType: "image/png",
      data: new Uint8Array([137, 80, 78, 71]), // PNG header bytes
    }),
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("get_image", {}),
    textResponse("I got the image"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [imgTool] });
  const result = await agent.run("get an image");
  assertEquals(result.output.includes("image"), true);
});

Deno.test("UploadedFile - tool can return UploadedFile without error", async () => {
  const fileTool = tool({
    name: "get_file",
    description: "Get a file",
    parameters: z.object({}),
    execute: (): Promise<
      import("../lib/multimodal/binary_content.ts").UploadedFile
    > => Promise.resolve({
      type: "uploaded_file",
      fileId: "file-test-123",
      mimeType: "application/pdf",
      filename: "document.pdf",
    }),
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("get_file", {}),
    textResponse("I got the file"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, tools: [fileTool] });
  const result = await agent.run("get a file");
  assertEquals(result.output.includes("file"), true);
});
