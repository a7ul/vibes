import { assertEquals, assertStringIncludes } from "@std/assert";
import { webFetchTool } from "../mod.ts";
import type { WebFetchResult } from "../mod.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FetchFn = typeof globalThis.fetch;

/** Creates a mock fetch that returns a fixed response. */
function mockFetch(
  body: string,
  contentType = "text/html",
  status = 200,
): FetchFn {
  return (_input, _init) =>
    Promise.resolve(
      new Response(body, {
        status,
        headers: { "Content-Type": contentType },
      }),
    );
}

/** Execute the web_fetch tool with a mock fetch and a given URL. */
async function runFetch(
  url: string,
  fetchFn: FetchFn,
  options: Parameters<typeof webFetchTool>[0] = {},
): Promise<WebFetchResult | string> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try {
    const t = webFetchTool(options);
    // deno-lint-ignore no-explicit-any
    return await (t.execute as any)(undefined, { url });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("webFetchTool - returns WebFetchResult for HTML response", async () => {
  const html = "<html><head><title>Hello Page</title></head><body><p>Hello World</p></body></html>";
  const result = await runFetch("https://example.com/page", mockFetch(html));

  assertEquals(typeof result, "object");
  const r = result as WebFetchResult;
  assertEquals(r.url, "https://example.com/page");
  assertEquals(r.title, "Hello Page");
  assertStringIncludes(r.content, "Hello World");
});

Deno.test("webFetchTool - returns plain text for markdown response", async () => {
  const md = "# Title\n\nSome **content**.";
  const result = await runFetch(
    "https://example.com/doc.md",
    mockFetch(md, "text/markdown"),
  );

  const r = result as WebFetchResult;
  assertEquals(r.content, md);
});

Deno.test("webFetchTool - pretty-prints JSON response", async () => {
  const json = JSON.stringify({ key: "value", num: 42 });
  const result = await runFetch(
    "https://example.com/api",
    mockFetch(json, "application/json"),
  );

  const r = result as WebFetchResult;
  assertStringIncludes(r.content, "```json");
  assertStringIncludes(r.content, '"key": "value"');
});

Deno.test("webFetchTool - truncates content to maxContentLength", async () => {
  const html = `<html><body>${"x".repeat(200)}</body></html>`;
  const result = await runFetch(
    "https://example.com/long",
    mockFetch(html),
    { maxContentLength: 50 },
  );

  const r = result as WebFetchResult;
  assertStringIncludes(r.content, "[Content truncated]");
  assertEquals(r.content.length <= 50 + "\n\n[Content truncated]".length, true);
});

Deno.test("webFetchTool - returns error string for blocked domain", async () => {
  const result = await runFetch(
    "https://evil.com/page",
    mockFetch("<html><body>evil</body></html>"),
    { blockedDomains: ["evil.com"] },
  );

  assertEquals(typeof result, "string");
  assertStringIncludes(result as string, "blocked");
});

Deno.test("webFetchTool - returns error string for domain not in allowedDomains", async () => {
  const result = await runFetch(
    "https://other.com/page",
    mockFetch("<html><body>other</body></html>"),
    { allowedDomains: ["trusted.com"] },
  );

  assertEquals(typeof result, "string");
  assertStringIncludes(result as string, "not allowed");
});

Deno.test("webFetchTool - returns error string for HTTP error response", async () => {
  const result = await runFetch(
    "https://example.com/not-found",
    mockFetch("Not Found", "text/html", 404),
  );

  assertEquals(typeof result, "string");
  assertStringIncludes(result as string, "404");
});

Deno.test("webFetchTool - returns error string for binary content", async () => {
  const result = await runFetch(
    "https://example.com/image.png",
    mockFetch("binary data", "image/png"),
  );

  assertEquals(typeof result, "string");
  assertStringIncludes(result as string, "image/png");
});

Deno.test("webFetchTool - returns error string for invalid URL", async () => {
  const result = await runFetch(
    "not-a-valid-url",
    mockFetch("body"),
  );

  assertEquals(typeof result, "string");
  assertStringIncludes(result as string, "invalid URL");
});

Deno.test("webFetchTool - tool has correct name and description", () => {
  const t = webFetchTool();
  assertEquals(t.name, "web_fetch");
  assertStringIncludes(t.description, "URL");
});
