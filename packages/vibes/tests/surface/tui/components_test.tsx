import { assertEquals, assertStringIncludes } from "@std/assert";
import React from "react";
import { render } from "ink-testing-library";
import { AssistantMessage } from "../../../src/surface/tui/components/assistant_message.tsx";
import { ErrorBanner } from "../../../src/surface/tui/components/error_banner.tsx";
import { StatusBar } from "../../../src/surface/tui/components/status_bar.tsx";
import { ToolIndicator } from "../../../src/surface/tui/components/tool_indicator.tsx";
import type { Usage } from "@vibes/framework";

// ink-testing-library internally creates timers/signal listeners.
// We use sanitizeOps/sanitizeResources: false to suppress Deno leak warnings.
const TEST_OPTIONS = { sanitizeOps: false, sanitizeResources: false };

Deno.test("AssistantMessage - renders content", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(AssistantMessage, { content: "Hello from assistant" }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "Hello from assistant");
  } finally {
    unmount();
  }
});

Deno.test("AssistantMessage - renders assistant label", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(AssistantMessage, { content: "hi" }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "assistant");
  } finally {
    unmount();
  }
});

Deno.test("AssistantMessage - renders streaming cursor when isStreaming=true", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(AssistantMessage, { content: "partial", isStreaming: true }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "partial");
    assertStringIncludes(frame, "▊");
  } finally {
    unmount();
  }
});

Deno.test("AssistantMessage - no cursor when isStreaming=false", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(AssistantMessage, { content: "done", isStreaming: false }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "done");
    assertEquals(frame.includes("▊"), false);
  } finally {
    unmount();
  }
});

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

Deno.test("StatusBar - renders state label", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(StatusBar, { agentState: "idle", usage: null, turnCount: 0 }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "ready");
  } finally {
    unmount();
  }
});

Deno.test("StatusBar - renders streaming state", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(StatusBar, { agentState: "streaming", usage: null, turnCount: 2 }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "streaming");
    assertStringIncludes(lastFrame() ?? "", "2");
  } finally {
    unmount();
  }
});

Deno.test("StatusBar - renders usage when provided", TEST_OPTIONS, () => {
  const usage: Usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150, requests: 2 };
  const { lastFrame, unmount } = render(
    React.createElement(StatusBar, { agentState: "complete", usage, turnCount: 1 }),
  );
  try {
    const frame = lastFrame() ?? "";
    assertStringIncludes(frame, "100");
    assertStringIncludes(frame, "50");
    assertStringIncludes(frame, "150");
  } finally {
    unmount();
  }
});

Deno.test("ToolIndicator - renders nothing when idle", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ToolIndicator, { agentState: "idle" }),
  );
  try {
    assertEquals(lastFrame(), "");
  } finally {
    unmount();
  }
});

Deno.test("ToolIndicator - renders working indicator when streaming", TEST_OPTIONS, () => {
  const { lastFrame, unmount } = render(
    React.createElement(ToolIndicator, { agentState: "streaming" }),
  );
  try {
    assertStringIncludes(lastFrame() ?? "", "Agent is working");
  } finally {
    unmount();
  }
});
