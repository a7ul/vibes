import { assertEquals, assertStringIncludes } from "@std/assert";
import React from "react";
import { render } from "ink-testing-library";
import { ErrorBanner } from "../../../src/surface/tui/components/error_banner.tsx";
import { StatusBar } from "../../../src/surface/tui/components/status_bar.tsx";
import { TextBlock } from "../../../src/surface/tui/components/text_block.tsx";
import { ToolCallItem } from "../../../src/surface/tui/components/tool_call_item.tsx";
import { ConversationView } from "../../../src/surface/tui/components/conversation_view.tsx";
import type { Usage } from "@vibes/framework";
import type { ConversationEntry } from "../../../src/surface/tui/types.ts";

// ink-testing-library internally creates timers/signal listeners.
// We use sanitizeOps/sanitizeResources: false to suppress Deno leak warnings.
const TEST_OPTIONS = { sanitizeOps: false, sanitizeResources: false };

// ---------------------------------------------------------------------------
// ErrorBanner
// ---------------------------------------------------------------------------

Deno.test("ErrorBanner - renders error message", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ErrorBanner, { message: "Something went wrong" }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "Something went wrong");
  } finally {
    unmount();
  }
});

Deno.test("ErrorBanner - renders Error label", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ErrorBanner, { message: "oops" }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "Error");
  } finally {
    unmount();
  }
});

// ---------------------------------------------------------------------------
// StatusBar
// ---------------------------------------------------------------------------

Deno.test("StatusBar - renders model name and turn count", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(StatusBar, { usage: null, currentTurn: 0 }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "turn");
    assertStringIncludes(frame, "0");
  } finally {
    unmount();
  }
});

Deno.test("StatusBar - renders turn count correctly", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(StatusBar, { usage: null, currentTurn: 3 }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "3");
  } finally {
    unmount();
  }
});

Deno.test("StatusBar - renders usage when provided", TEST_OPTIONS, () => {
  const usage: Usage = { inputTokens: 1200, outputTokens: 800, totalTokens: 2000, requests: 2 };
  const { lastFrame, unmount } = render(
    React.createElement(StatusBar, { usage, currentTurn: 1 }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "1.2k");
    assertStringIncludes(frame, "800");
  } finally {
    unmount();
  }
});

Deno.test("StatusBar - does not render usage section when null", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(StatusBar, { usage: null, currentTurn: 0 }),
  );
  try {
    assertEquals((lastFrame() ?? "").includes("tokens"), false);
  } finally {
    unmount();
  }
});

// ---------------------------------------------------------------------------
// TextBlock
// ---------------------------------------------------------------------------

Deno.test("TextBlock - renders content", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(TextBlock, { content: "Hello world" }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "Hello world");
  } finally {
    unmount();
  }
});

Deno.test("TextBlock - renders cursor when showCursor=true", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(TextBlock, { content: "partial", showCursor: true }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "partial");
    assertStringIncludes(frame, "▊");
  } finally {
    unmount();
  }
});

Deno.test("TextBlock - no cursor when showCursor=false", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(TextBlock, { content: "done", showCursor: false }),
  );
  try {
    assertEquals((lastFrame() ?? "").includes("▊"), false);
  } finally {
    unmount();
  }
});

// ---------------------------------------------------------------------------
// ToolCallItem
// ---------------------------------------------------------------------------

Deno.test("ToolCallItem - renders tool name when running", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ToolCallItem, {
      toolName: "bash",
      toolCallId: "tc1",
      args: { command: "echo hi" },
      status: "running",
    }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "bash");
  } finally {
    unmount();
  }
});

Deno.test("ToolCallItem - renders args when running", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ToolCallItem, {
      toolName: "bash",
      toolCallId: "tc1",
      args: { command: "echo hi" },
      status: "running",
    }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "echo hi");
  } finally {
    unmount();
  }
});

Deno.test("ToolCallItem - renders checkmark when done", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ToolCallItem, {
      toolName: "read_file",
      toolCallId: "tc2",
      args: { path: "/tmp/foo.ts" },
      result: "file content",
      status: "done",
    }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "✓");
    assertStringIncludes(frame, "read_file");
  } finally {
    unmount();
  }
});

Deno.test("ToolCallItem - renders result when done", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ToolCallItem, {
      toolName: "bash",
      toolCallId: "tc3",
      args: { command: "ls" },
      result: "file1.ts\nfile2.ts",
      status: "done",
    }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "↳");
  } finally {
    unmount();
  }
});

Deno.test("ToolCallItem - does not render result when running", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ToolCallItem, {
      toolName: "bash",
      toolCallId: "tc4",
      args: { command: "ls" },
      status: "running",
    }),
  );
  try {
    assertEquals((lastFrame() ?? "").includes("↳"), false);
  } finally {
    unmount();
  }
});

// ---------------------------------------------------------------------------
// ConversationView
// ---------------------------------------------------------------------------

Deno.test("ConversationView - renders empty state without errors", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ConversationView, { entries: [] }),
  );
  try {
    assertEquals(typeof lastFrame(), "string");
  } finally {
    unmount();
  }
});

Deno.test("ConversationView - renders user message with > prefix", TEST_OPTIONS, () => {
  const entries: ConversationEntry[] = [
    { kind: "user", id: "u1", content: "hello there" },
  ];
  const { lastFrame, unmount } = render(
    React.createElement(ConversationView, { entries }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "hello there");
    assertStringIncludes(frame, ">");
  } finally {
    unmount();
  }
});

Deno.test("ConversationView - renders assistant text content", TEST_OPTIONS, () => {
  const entries: ConversationEntry[] = [
    {
      kind: "assistant",
      id: "a1",
      items: [{ kind: "text", content: "I can help with that" }],
      status: "complete",
    },
  ];
  const { lastFrame, unmount } = render(
    React.createElement(ConversationView, { entries }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "I can help with that");
  } finally {
    unmount();
  }
});
