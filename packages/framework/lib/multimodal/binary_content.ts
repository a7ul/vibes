/**
 * Multi-modal content types for tool returns.
 *
 * Tools can return `BinaryContent` (images, audio, etc.) or `UploadedFile`
 * references in addition to plain strings and objects. The run loop converts
 * these to the appropriate AI SDK content parts before sending results to the
 * model.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// BinaryContent
// ---------------------------------------------------------------------------

export type BinaryContent = {
  type: "binary";
  mimeType: string;
  data: Uint8Array;
};

/** Convenience alias — all binary content is also image-compatible. */
export type BinaryImage = BinaryContent & { type: "binary" };

export function isBinaryContent(v: unknown): v is BinaryContent {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).type === "binary" &&
    typeof (v as Record<string, unknown>).mimeType === "string" &&
    (v as Record<string, unknown>).data instanceof Uint8Array
  );
}

// ---------------------------------------------------------------------------
// UploadedFile
// ---------------------------------------------------------------------------

export type UploadedFile = {
  type: "uploaded_file";
  fileId: string;
  mimeType: string;
  filename?: string;
};

export function isUploadedFile(v: unknown): v is UploadedFile {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).type === "uploaded_file" &&
    typeof (v as Record<string, unknown>).fileId === "string" &&
    typeof (v as Record<string, unknown>).mimeType === "string"
  );
}

// ---------------------------------------------------------------------------
// Union helper
// ---------------------------------------------------------------------------

/** All non-text tool return types. */
export type MultiModalContent = BinaryContent | UploadedFile;

export function isMultiModalContent(v: unknown): v is MultiModalContent {
  return isBinaryContent(v) || isUploadedFile(v);
}

// ---------------------------------------------------------------------------
// MIME type guards
// ---------------------------------------------------------------------------

/** Returns true if the content has an image/* MIME type. */
export function isImageContent(v: BinaryContent): boolean {
  return v.mimeType.startsWith("image/");
}

/** Returns true if the content has an audio/* MIME type. */
export function isAudioContent(v: BinaryContent): boolean {
  return v.mimeType.startsWith("audio/");
}

/** Returns true if the content has a video/* MIME type. */
export function isVideoContent(v: BinaryContent): boolean {
  return v.mimeType.startsWith("video/");
}

/**
 * Returns true if the content is a document type:
 * application/pdf, application/msword, application/vnd.*, text/*, etc.
 */
export function isDocumentContent(v: BinaryContent): boolean {
  return (
    v.mimeType === "application/pdf" ||
    v.mimeType.startsWith("application/msword") ||
    v.mimeType.startsWith("application/vnd.") ||
    v.mimeType.startsWith("text/")
  );
}

// ---------------------------------------------------------------------------
// Zod schemas — tools can use these in their parameters
// ---------------------------------------------------------------------------

/**
 * Zod schema for `BinaryContent`. Tools can use this in their `parameters`
 * to declare that they accept binary (image, audio, video, document) content.
 *
 * @example
 * ```ts
 * const analyzeTool = tool({
 *   name: "analyze_image",
 *   description: "Analyze an image",
 *   parameters: z.object({ image: binaryContentSchema }),
 *   execute: async (ctx, args) => analyze(args.image),
 * });
 * ```
 */
export const binaryContentSchema: z.ZodType<BinaryContent> = z.object({
  type: z.literal("binary"),
  mimeType: z.string(),
  data: z.instanceof(Uint8Array),
});

/**
 * Zod schema for `UploadedFile`. Tools can use this in their `parameters`
 * to declare that they accept file references by ID.
 */
export const uploadedFileSchema: z.ZodType<UploadedFile> = z.object({
  type: z.literal("uploaded_file"),
  fileId: z.string(),
  mimeType: z.string(),
  filename: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Conversion — BinaryContent → AI SDK image content part
// ---------------------------------------------------------------------------

/**
 * Convert a `BinaryContent` value to a base64-encoded AI SDK image content
 * part suitable for inclusion in a tool result message.
 */
export function binaryContentToBase64(content: BinaryContent): string {
  // Convert Uint8Array to base64 string
  let binary = "";
  const bytes = content.data;
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Produce a `data:mimeType;base64,<data>` URL string from a `BinaryContent`.
 * Useful for embedding binary data directly in HTML attributes or CSS.
 */
export function toDataUrl(content: BinaryContent): string {
  const base64 = binaryContentToBase64(content);
  return `data:${content.mimeType};base64,${base64}`;
}

/**
 * Build the AI SDK tool result content part for a `BinaryContent` value.
 * Returns an image content part with base64-encoded data URI.
 */
export function binaryContentToToolResult(content: BinaryContent): {
  type: "image";
  image: string;
  mimeType: string;
} {
  const base64 = binaryContentToBase64(content);
  return {
    type: "image" as const,
    image: `data:${content.mimeType};base64,${base64}`,
    mimeType: content.mimeType,
  };
}

/**
 * Build the AI SDK tool result content part for an `UploadedFile` value.
 * Returns a file reference as a text content part (AI SDK v6 does not have
 * a dedicated file-reference content part yet).
 */
export function uploadedFileToToolResult(file: UploadedFile): {
  type: "text";
  text: string;
} {
  const label = file.filename ? ` (${file.filename})` : "";
  return {
    type: "text" as const,
    text: `[file:${file.fileId}${label} mime=${file.mimeType}]`,
  };
}

// ---------------------------------------------------------------------------
// BinaryImage output sentinel — use as outputSchema for image-generating agents
// ---------------------------------------------------------------------------

/** Sentinel value: pass as `outputSchema` to indicate the agent should return
 *  a `BinaryContent` (image) as its final output instead of text or JSON.
 *  The first tool result with an image/* MIME type becomes the output. */
export const BINARY_IMAGE_OUTPUT: unique symbol = Symbol("BINARY_IMAGE_OUTPUT");
export type BinaryImageOutputSentinel = typeof BINARY_IMAGE_OUTPUT;

export function isBinaryImageOutput(
  schema: unknown,
): schema is BinaryImageOutputSentinel {
  return schema === BINARY_IMAGE_OUTPUT;
}

/**
 * Try to extract a `BinaryContent` from a tool output that was produced by
 * converting a `BinaryContent` via `binaryContentToToolResult`. That function
 * produces `{ type: "image", image: "data:<mime>;base64,<data>", mimeType }`.
 * Returns `null` if the output does not look like a converted binary image.
 */
export function extractBinaryImageFromToolOutput(
  output: unknown,
): BinaryContent | null {
  if (
    typeof output !== "object" ||
    output === null ||
    (output as Record<string, unknown>)["type"] !== "image"
  ) {
    return null;
  }
  const obj = output as Record<string, unknown>;
  const image = obj["image"];
  const mimeType = obj["mimeType"];
  if (
    typeof image !== "string" ||
    typeof mimeType !== "string" ||
    !mimeType.startsWith("image/")
  ) {
    return null;
  }
  const commaIdx = image.indexOf(",");
  if (commaIdx === -1) return null;
  const base64 = image.slice(commaIdx + 1);
  const binaryString = atob(base64);
  const data = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    data[i] = binaryString.charCodeAt(i);
  }
  return { type: "binary", mimeType, data };
}
