/**
 * Tests for Phase 13: Multi-Modal Support
 *
 * Covers:
 * - 13.1  Zod schemas for BinaryContent and UploadedFile
 * - 13.2  toDataUrl() and MIME-type guards
 * - 13.3  uploadedFileToToolResult correctness
 * - 13.4  imageMessage / audioMessage / fileMessage helpers
 */

import { assertEquals, assert, assertThrows } from "@std/assert";
import { z } from "zod";

import {
	type BinaryContent,
	type UploadedFile,
	binaryContentSchema,
	uploadedFileSchema,
	isImageContent,
	isAudioContent,
	isVideoContent,
	isDocumentContent,
	toDataUrl,
	binaryContentToBase64,
	uploadedFileToToolResult,
} from "../binary_content.ts";

import {
	imageMessage,
	audioMessage,
	fileMessage,
} from "../content.ts";

// ---------------------------------------------------------------------------
// 13.1  Zod schemas
// ---------------------------------------------------------------------------

Deno.test("binaryContentSchema - parses valid BinaryContent", () => {
	const input: unknown = {
		type: "binary",
		mimeType: "image/png",
		data: new Uint8Array([1, 2, 3]),
	};
	const result = binaryContentSchema.parse(input);
	assertEquals(result.type, "binary");
	assertEquals(result.mimeType, "image/png");
	assertEquals(result.data, new Uint8Array([1, 2, 3]));
});

Deno.test("binaryContentSchema - rejects missing type field", () => {
	assertThrows(() => {
		binaryContentSchema.parse({ mimeType: "image/png", data: new Uint8Array() });
	});
});

Deno.test("binaryContentSchema - rejects wrong type value", () => {
	assertThrows(() => {
		binaryContentSchema.parse({
			type: "text",
			mimeType: "image/png",
			data: new Uint8Array(),
		});
	});
});

Deno.test("binaryContentSchema - rejects non-Uint8Array data", () => {
	assertThrows(() => {
		binaryContentSchema.parse({
			type: "binary",
			mimeType: "image/png",
			data: "base64string",
		});
	});
});

Deno.test("binaryContentSchema - rejects missing mimeType", () => {
	assertThrows(() => {
		binaryContentSchema.parse({ type: "binary", data: new Uint8Array() });
	});
});

Deno.test("uploadedFileSchema - parses valid UploadedFile without filename", () => {
	const input: unknown = {
		type: "uploaded_file",
		fileId: "file-abc",
		mimeType: "application/pdf",
	};
	const result = uploadedFileSchema.parse(input);
	assertEquals(result.type, "uploaded_file");
	assertEquals(result.fileId, "file-abc");
	assertEquals(result.mimeType, "application/pdf");
	assertEquals(result.filename, undefined);
});

Deno.test("uploadedFileSchema - parses valid UploadedFile with filename", () => {
	const input: unknown = {
		type: "uploaded_file",
		fileId: "file-xyz",
		mimeType: "image/jpeg",
		filename: "photo.jpg",
	};
	const result = uploadedFileSchema.parse(input);
	assertEquals(result.filename, "photo.jpg");
});

Deno.test("uploadedFileSchema - rejects missing fileId", () => {
	assertThrows(() => {
		uploadedFileSchema.parse({ type: "uploaded_file", mimeType: "image/png" });
	});
});

Deno.test("uploadedFileSchema - rejects wrong type literal", () => {
	assertThrows(() => {
		uploadedFileSchema.parse({
			type: "binary",
			fileId: "f1",
			mimeType: "image/png",
		});
	});
});

Deno.test("binaryContentSchema - can be used in z.object parameters", () => {
	const toolParams = z.object({
		image: binaryContentSchema,
		label: z.string(),
	});
	const parsed = toolParams.parse({
		image: { type: "binary", mimeType: "image/png", data: new Uint8Array([9]) },
		label: "test",
	});
	assertEquals(parsed.label, "test");
	assertEquals(parsed.image.mimeType, "image/png");
});

// ---------------------------------------------------------------------------
// 13.2  toDataUrl() and MIME-type guards
// ---------------------------------------------------------------------------

Deno.test("toDataUrl - produces correct data URL", () => {
	const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
	const bc: BinaryContent = { type: "binary", mimeType: "image/png", data };
	const url = toDataUrl(bc);
	assertEquals(url, "data:image/png;base64,SGVsbG8=");
});

Deno.test("toDataUrl - round-trips through binaryContentToBase64", () => {
	const data = new Uint8Array([0, 1, 2, 255]);
	const bc: BinaryContent = { type: "binary", mimeType: "application/octet-stream", data };
	const url = toDataUrl(bc);
	const base64 = binaryContentToBase64(bc);
	assertEquals(url, `data:application/octet-stream;base64,${base64}`);
});

Deno.test("toDataUrl - handles empty data", () => {
	const bc: BinaryContent = { type: "binary", mimeType: "image/gif", data: new Uint8Array() };
	assertEquals(toDataUrl(bc), "data:image/gif;base64,");
});

Deno.test("isImageContent - returns true for image/* MIME types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assert(isImageContent(bc("image/png")));
	assert(isImageContent(bc("image/jpeg")));
	assert(isImageContent(bc("image/gif")));
	assert(isImageContent(bc("image/webp")));
});

Deno.test("isImageContent - returns false for non-image types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assertEquals(isImageContent(bc("audio/mp3")), false);
	assertEquals(isImageContent(bc("video/mp4")), false);
	assertEquals(isImageContent(bc("application/pdf")), false);
	assertEquals(isImageContent(bc("text/plain")), false);
});

Deno.test("isAudioContent - returns true for audio/* MIME types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assert(isAudioContent(bc("audio/mp3")));
	assert(isAudioContent(bc("audio/wav")));
	assert(isAudioContent(bc("audio/ogg")));
});

Deno.test("isAudioContent - returns false for non-audio types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assertEquals(isAudioContent(bc("image/png")), false);
	assertEquals(isAudioContent(bc("video/mp4")), false);
});

Deno.test("isVideoContent - returns true for video/* MIME types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assert(isVideoContent(bc("video/mp4")));
	assert(isVideoContent(bc("video/webm")));
	assert(isVideoContent(bc("video/ogg")));
});

Deno.test("isVideoContent - returns false for non-video types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assertEquals(isVideoContent(bc("image/png")), false);
	assertEquals(isVideoContent(bc("audio/wav")), false);
});

Deno.test("isDocumentContent - returns true for PDF", () => {
	const bc: BinaryContent = {
		type: "binary",
		mimeType: "application/pdf",
		data: new Uint8Array(),
	};
	assert(isDocumentContent(bc));
});

Deno.test("isDocumentContent - returns true for text/* MIME types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assert(isDocumentContent(bc("text/plain")));
	assert(isDocumentContent(bc("text/html")));
	assert(isDocumentContent(bc("text/csv")));
});

Deno.test("isDocumentContent - returns true for application/vnd.* types", () => {
	const bc: BinaryContent = {
		type: "binary",
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		data: new Uint8Array(),
	};
	assert(isDocumentContent(bc));
});

Deno.test("isDocumentContent - returns false for image/audio/video types", () => {
	const bc = (mimeType: string): BinaryContent => ({
		type: "binary",
		mimeType,
		data: new Uint8Array(),
	});
	assertEquals(isDocumentContent(bc("image/png")), false);
	assertEquals(isDocumentContent(bc("audio/mp3")), false);
	assertEquals(isDocumentContent(bc("video/mp4")), false);
});

// ---------------------------------------------------------------------------
// 13.3  uploadedFileToToolResult correctness
// ---------------------------------------------------------------------------

Deno.test("uploadedFileToToolResult - produces text part with file reference", () => {
	const uf: UploadedFile = {
		type: "uploaded_file",
		fileId: "file-123",
		mimeType: "application/pdf",
	};
	const part = uploadedFileToToolResult(uf);
	assertEquals(part.type, "text");
	assertEquals(part.text, "[file:file-123 mime=application/pdf]");
});

Deno.test("uploadedFileToToolResult - includes filename when present", () => {
	const uf: UploadedFile = {
		type: "uploaded_file",
		fileId: "file-456",
		mimeType: "image/png",
		filename: "screenshot.png",
	};
	const part = uploadedFileToToolResult(uf);
	assertEquals(part.text, "[file:file-456 (screenshot.png) mime=image/png]");
});

Deno.test("uploadedFileToToolResult - omits filename parens when undefined", () => {
	const uf: UploadedFile = {
		type: "uploaded_file",
		fileId: "f",
		mimeType: "text/plain",
	};
	const part = uploadedFileToToolResult(uf);
	assert(!part.text.includes("("));
});

// ---------------------------------------------------------------------------
// 13.4  Multi-modal user message helpers
// ---------------------------------------------------------------------------

Deno.test("imageMessage - returns user role message", () => {
	const msg = imageMessage(new Uint8Array([1, 2, 3]));
	assertEquals(msg.role, "user");
});

Deno.test("imageMessage - content contains image part when no text", () => {
	const bytes = new Uint8Array([1, 2, 3]);
	const msg = imageMessage(bytes);
	assert(Array.isArray(msg.content));
	assertEquals((msg.content as Array<{ type: string }>).length, 1);
	assertEquals((msg.content as Array<{ type: string }>)[0].type, "image");
});

Deno.test("imageMessage - content contains text + image when text provided", () => {
	const msg = imageMessage(new Uint8Array([1]), "Describe this");
	assert(Array.isArray(msg.content));
	const parts = msg.content as Array<{ type: string; text?: string }>;
	assertEquals(parts.length, 2);
	assertEquals(parts[0].type, "text");
	assertEquals(parts[0].text, "Describe this");
	assertEquals(parts[1].type, "image");
});

Deno.test("imageMessage - passes mediaType through to image part", () => {
	const msg = imageMessage("base64data", undefined, "image/webp");
	const parts = msg.content as Array<{ type: string; mediaType?: string }>;
	assertEquals(parts[0].mediaType, "image/webp");
});

Deno.test("imageMessage - accepts URL as image source", () => {
	const url = new URL("https://example.com/photo.jpg");
	const msg = imageMessage(url, "Alt text");
	const parts = msg.content as Array<{ type: string; image?: unknown }>;
	const imagePart = parts.find((p) => p.type === "image") as { image: unknown } | undefined;
	assert(imagePart !== undefined);
	assertEquals(imagePart.image, url);
});

Deno.test("imageMessage - accepts base64 string as image source", () => {
	const msg = imageMessage("SGVsbG8=", "Hello image");
	const parts = msg.content as Array<{ type: string; image?: unknown }>;
	const imagePart = parts.find((p) => p.type === "image") as { image: unknown } | undefined;
	assert(imagePart !== undefined);
	assertEquals(imagePart.image, "SGVsbG8=");
});

Deno.test("audioMessage - returns user role message", () => {
	const msg = audioMessage(new Uint8Array([0, 1]), "audio/wav");
	assertEquals(msg.role, "user");
});

Deno.test("audioMessage - content contains file part with audio mediaType", () => {
	const msg = audioMessage(new Uint8Array([0, 1]), "audio/mp3");
	const parts = msg.content as Array<{ type: string; mediaType?: string }>;
	assertEquals(parts.length, 1);
	assertEquals(parts[0].type, "file");
	assertEquals(parts[0].mediaType, "audio/mp3");
});

Deno.test("audioMessage - includes text part before audio when text provided", () => {
	const msg = audioMessage("base64audio", "audio/ogg", "Transcribe this");
	const parts = msg.content as Array<{ type: string; text?: string }>;
	assertEquals(parts.length, 2);
	assertEquals(parts[0].type, "text");
	assertEquals(parts[0].text, "Transcribe this");
	assertEquals(parts[1].type, "file");
});

Deno.test("fileMessage - returns user role message", () => {
	const msg = fileMessage(new Uint8Array([37, 80, 68, 70]), "application/pdf");
	assertEquals(msg.role, "user");
});

Deno.test("fileMessage - content contains file part with correct mediaType", () => {
	const msg = fileMessage("data", "application/pdf");
	const parts = msg.content as Array<{ type: string; mediaType?: string; data?: unknown }>;
	assertEquals(parts.length, 1);
	assertEquals(parts[0].type, "file");
	assertEquals(parts[0].mediaType, "application/pdf");
	assertEquals(parts[0].data, "data");
});

Deno.test("fileMessage - includes text part before file when text provided", () => {
	const msg = fileMessage(new Uint8Array([1]), "text/csv", "Parse this CSV");
	const parts = msg.content as Array<{ type: string; text?: string }>;
	assertEquals(parts.length, 2);
	assertEquals(parts[0].text, "Parse this CSV");
	assertEquals(parts[1].type, "file");
});

Deno.test("fileMessage - works with various document MIME types", () => {
	const pdfMsg = fileMessage("pdf", "application/pdf");
	const csvMsg = fileMessage("csv", "text/csv");
	const docxMsg = fileMessage(
		"docx",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	);
	const pdfParts = pdfMsg.content as Array<{ mediaType?: string }>;
	const csvParts = csvMsg.content as Array<{ mediaType?: string }>;
	const docxParts = docxMsg.content as Array<{ mediaType?: string }>;
	assertEquals(pdfParts[0].mediaType, "application/pdf");
	assertEquals(csvParts[0].mediaType, "text/csv");
	assertEquals(
		docxParts[0].mediaType,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	);
});
