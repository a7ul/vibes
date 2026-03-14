---
title: "Multi-Modal"
description: "Images, audio, and file inputs"
---

# Multi-Modal

Tools can return images, audio, and file references in addition to plain strings
and objects. The framework converts these to the appropriate AI SDK content
parts before feeding them back to the model.

## `BinaryContent`

Return raw binary data (images, audio, documents) from a tool:

```ts
import { tool } from "@vibes/framework";
import type { BinaryContent } from "@vibes/framework";
import { z } from "zod";

const screenshot = tool({
  name: "screenshot",
  description: "Take a screenshot of a URL and return it",
  parameters: z.object({ url: z.string() }),
  execute: async (_ctx, { url }): Promise<BinaryContent> => {
    const data = await captureScreenshot(url);
    return {
      type: "binary",
      mimeType: "image/png",
      data, // Uint8Array
    };
  },
});
```

The model receives the binary data as an inline content part (base64-encoded).
Use this for images the model should see directly.

## `UploadedFile`

For large files, reference a pre-uploaded file by ID rather than sending bytes
inline:

```ts
import type { UploadedFile } from "@vibes/framework";

const readPdf = tool({
  name: "read_pdf",
  description: "Read a PDF document",
  parameters: z.object({ fileId: z.string() }),
  execute: async (_ctx, { fileId }): Promise<UploadedFile> => {
    return {
      type: "uploaded-file",
      fileId, // provider-specific file reference
      mimeType: "application/pdf",
    };
  },
});
```

The model receives a file reference rather than inline bytes. The provider must
support file uploads (e.g. OpenAI Files API).

## Message Helpers

Use the convenience helpers to build user messages that include media:

```ts
import { audioMessage, fileMessage, imageMessage } from "@vibes/framework";

// Image from URL
const msg = imageMessage(
  "https://example.com/photo.jpg",
  "Describe this image.",
);

// Image from local bytes
const bytes = await Deno.readFile("./chart.png");
const msg = imageMessage(
  { data: bytes, mimeType: "image/png" },
  "What does this chart show?",
);

// Audio
const audio = await Deno.readFile("./recording.mp3");
const msg = audioMessage(
  { data: audio, mimeType: "audio/mpeg" },
  "Transcribe this.",
);

// File
const msg = fileMessage(
  { fileId: "file-abc123", mimeType: "application/pdf" },
  "Summarise.",
);
```

Pass these messages as `messageHistory` or as the prompt to `.run()`:

```ts
const result = await agent.run(
  imageMessage(screenshotUrl, "What's on screen?"),
);
```

## Zod Schemas for Tool Parameters

Use the provided Zod schema helpers when a tool needs to accept binary content
as input parameters:

```ts
import { BinaryContentSchema, UploadedFileSchema } from "@vibes/framework";

const analyseTool = tool({
  name: "analyse_image",
  description: "Analyse an uploaded image",
  parameters: z.object({
    image: BinaryContentSchema,
    prompt: z.string(),
  }),
  execute: async (_ctx, { image, prompt }) => {
    // image is typed as BinaryContent
    return processImage(image.data, image.mimeType, prompt);
  },
});
```

## Type Guards

Use `isBinaryContent` and `isUploadedFile` to narrow types at runtime:

```ts
import { isBinaryContent, isUploadedFile } from "@vibes/framework";

execute: async (_ctx, args) => {
  const result = await fetchResource(args.id);
  if (isBinaryContent(result)) {
    return { type: "binary", mimeType: result.mimeType, data: result.data };
  }
  if (isUploadedFile(result)) {
    return { type: "uploaded-file", fileId: result.fileId, mimeType: result.mimeType };
  }
  return String(result);
},
```

## API Reference

### `BinaryContent`

| Field      | Type         | Description                                   |
| ---------- | ------------ | --------------------------------------------- |
| `type`     | `"binary"`   | Discriminator                                 |
| `mimeType` | `string`     | MIME type (e.g. `"image/png"`, `"audio/mp3"`) |
| `data`     | `Uint8Array` | Raw bytes                                     |

### `UploadedFile`

| Field      | Type              | Description                      |
| ---------- | ----------------- | -------------------------------- |
| `type`     | `"uploaded-file"` | Discriminator                    |
| `fileId`   | `string`          | Provider-specific file reference |
| `mimeType` | `string`          | MIME type of the file            |

### Message Helpers

| Helper         | Signature                                                 | Description                        |
| -------------- | --------------------------------------------------------- | ---------------------------------- |
| `imageMessage` | `(image: string \| BinaryContent, text?) => ModelMessage` | Build a user message with an image |
| `audioMessage` | `(audio: BinaryContent, text?) => ModelMessage`           | Build a user message with audio    |
| `fileMessage`  | `(file: UploadedFile, text?) => ModelMessage`             | Build a user message with a file   |

## Error Behavior

- Returning `BinaryContent` from a tool with a MIME type the model does not
  support (e.g. `video/mp4` to a text-only model) will cause a provider API
  error.
- `isUploadedFile` / `isBinaryContent` return `false` for `null` or non-object
  values — always check before accessing fields.
- Large `Uint8Array` values are base64-encoded inline. For files larger than ~5
  MB, prefer the `UploadedFile` pattern with a pre-uploaded file ID.
