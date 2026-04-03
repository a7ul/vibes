import { z } from "zod";
import type { ToolDefinition } from "../tool.ts";

// ---------------------------------------------------------------------------
// Simple HTML-to-text helper (no external dependency)
// ---------------------------------------------------------------------------

/** Strip HTML tags and decode common entities, producing plain text.
 *
 * Implementation notes:
 * - Script/style blocks are removed by stripping the entire region between the
 *   opening tag and the matching closing tag.  We locate each opening `<script`
 *   or `<style` and scan forward for the corresponding `</script>` /
 *   `</style>` (case-insensitive, tolerating optional whitespace before `>`).
 * - All remaining markup is then stripped with a generic tag-removal pass.
 * - HTML entities are decoded exactly once — `&amp;` → `&`, etc.  The decode
 *   step runs *after* all tag removal so the original entity text cannot
 *   re-introduce markup.
 */
function htmlToText(html: string): string {
  // Remove <script>...</script> blocks (tolerates attributes and whitespace)
  let result = removeTaggedBlocks(html, "script");
  // Remove <style>...</style> blocks
  result = removeTaggedBlocks(result, "style");
  // Convert block-level elements to newlines
  result = result.replace(/<\/?(p|div|br|li|h[1-6]|tr|td|th)[^>]*>/gi, "\n");
  // Strip all remaining complete tags (<...>)
  result = result.replace(/<[^>]*>/g, "");
  // Remove any remaining angle-bracket fragments (e.g. unclosed <script)
  result = result.replace(/<[^>]*/g, "");
  // Decode HTML entities (once, after all markup has been removed)
  result = decodeEntities(result);
  // Collapse excess whitespace
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Remove all `<tagName ...>...</tagName>` blocks from `input`.
 * The closing tag pattern `</tagName` allows optional whitespace before `>`.
 */
function removeTaggedBlocks(input: string, tagName: string): string {
  const lower = input.toLowerCase();
  const open = "<" + tagName;
  const close = "</" + tagName;
  let out = "";
  let pos = 0;
  while (pos < input.length) {
    const start = lower.indexOf(open, pos);
    if (start === -1) {
      out += input.slice(pos);
      break;
    }
    out += input.slice(pos, start);
    // Find the end of the opening tag
    const tagEnd = lower.indexOf(">", start);
    if (tagEnd === -1) { pos = input.length; break; }
    // Find the closing tag
    const closeStart = lower.indexOf(close, tagEnd + 1);
    if (closeStart === -1) { pos = input.length; break; }
    // Find the end of the closing tag (tolerate whitespace before `>`)
    let closeEnd = closeStart + close.length;
    while (closeEnd < input.length && input[closeEnd] !== ">") closeEnd++;
    pos = closeEnd + 1;
  }
  return out;
}

/** Decode a fixed set of HTML character references — runs exactly once. */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // &amp; must be last to avoid double-decoding
}

/** Extract the <title> from an HTML string, or return empty string. */
function extractTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? match[1].trim() : "";
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/** Result returned by the `web_fetch` tool for textual content. */
export interface WebFetchResult {
  /** The URL that was fetched. */
  url: string;
  /** The page title, or empty string if not found. */
  title: string;
  /** The page content as plain text (HTML stripped). */
  content: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for the `webFetchTool` factory. */
export interface WebFetchToolOptions {
  /**
   * Maximum character length of the returned content.
   * Defaults to `50_000`. Set to `undefined` for no limit.
   */
  maxContentLength?: number | undefined;
  /**
   * Request timeout in milliseconds. Defaults to `30_000` (30 s).
   */
  timeoutMs?: number;
  /**
   * Only allow fetching from these exact hostnames.
   * When set, any other hostname throws a tool error.
   */
  allowedDomains?: string[];
  /**
   * Never fetch from these exact hostnames.
   * When set, any matching hostname throws a tool error.
   */
  blockedDomains?: string[];
  /**
   * Additional HTTP headers to include in the request.
   */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a `web_fetch` tool that fetches a URL and returns its content.
 *
 * For HTML pages the content is converted to plain text (tags stripped).
 * For JSON responses the content is pretty-printed. For other text types the
 * raw text is returned. Binary responses return a descriptive error string.
 *
 * Equivalent to Pydantic AI's `web_fetch_tool()` common tool.
 *
 * @example
 * ```ts
 * import { Agent } from "@vibesjs/sdk";
 * import { webFetchTool } from "@vibesjs/sdk/common-tools";
 *
 * const agent = new Agent({ model, tools: [webFetchTool()] });
 * ```
 */
export function webFetchTool(
  options: WebFetchToolOptions = {},
): ToolDefinition<undefined> {
  const {
    maxContentLength = 50_000,
    timeoutMs = 30_000,
    allowedDomains,
    blockedDomains,
    headers: extraHeaders,
  } = options;

  const parameters = z.object({
    url: z.string().describe("The URL to fetch."),
  });

  return {
    name: "web_fetch",
    description:
      "Fetches the content of a web page at the given URL and returns it as text.",
    parameters,
    execute: async (
      _ctx,
      args: unknown,
    ): Promise<WebFetchResult | string> => {
      const { url } = args as { url: string };

      // Domain allow/block validation
      let hostname: string;
      try {
        hostname = new URL(url).hostname;
      } catch {
        return `Failed to fetch ${url}: invalid URL`;
      }

      if (allowedDomains && !allowedDomains.includes(hostname)) {
        return `Fetching from '${hostname}' is not allowed (not in allowedDomains).`;
      }
      if (blockedDomains?.includes(hostname)) {
        return `Fetching from '${hostname}' is blocked.`;
      }

      const requestHeaders: Record<string, string> = {
        "Accept": "text/markdown, text/html;q=0.9, */*;q=0.8",
        ...extraHeaders,
      };

      let response: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          response = await fetch(url, {
            headers: requestHeaders,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Failed to fetch ${url}: ${msg}`;
      }

      if (!response.ok) {
        return `Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();

      // Binary content — return a descriptive string
      if (
        contentType &&
        !contentType.startsWith("text/") &&
        contentType !== "application/json" &&
        contentType !== "application/xhtml+xml"
      ) {
        return `Binary content at ${url} (${contentType || "unknown type"}) — cannot display.`;
      }

      let text: string;
      try {
        text = await response.text();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Failed to read response from ${url}: ${msg}`;
      }

      let title = "";
      let content: string;

      if (contentType === "text/markdown" || contentType === "text/x-markdown") {
        content = text;
      } else if (
        !contentType ||
        contentType === "text/html" ||
        contentType === "application/xhtml+xml"
      ) {
        title = extractTitle(text);
        content = htmlToText(text);
      } else if (contentType === "application/json") {
        try {
          const parsed: unknown = JSON.parse(text);
          content = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
        } catch {
          content = text;
        }
      } else {
        content = text;
      }

      if (maxContentLength !== undefined && content.length > maxContentLength) {
        content = content.slice(0, maxContentLength) + "\n\n[Content truncated]";
      }

      return { url, title, content };
    },
  };
}
