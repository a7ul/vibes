/**
 * Multi-modal content types for tool returns.
 *
 * Tools can return `BinaryContent` (images, audio, etc.) or `UploadedFile`
 * references in addition to plain strings and objects. The run loop converts
 * these to the appropriate AI SDK content parts before sending results to the
 * model.
 */

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
