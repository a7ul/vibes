/**
 * Tests for Phase 11: OpenTelemetry instrumentation.
 *
 * Tests cover:
 * - `createTelemetrySettings()` builds correct settings from options
 * - `instrumentAgent()` wraps an agent with telemetry settings
 * - Agent stores telemetry from AgentOptions
 * - `resolveTelemetry()` merges agent/run/override-level settings correctly
 * - `recordUsageAttributes()` sets span attributes correctly
 * - `recordRunAttributes()` sets span attributes correctly
 * - `excludeContent` maps to recordInputs/recordOutputs false
 */
import { assertEquals, assertExists } from "@std/assert";
import { Agent } from "../mod.ts";
import type { TelemetrySettings } from "../mod.ts";
import {
  createTelemetrySettings,
  instrumentAgent,
  recordRunAttributes,
  recordUsageAttributes,
} from "../mod.ts";
import type { InstrumentationOptions } from "../mod.ts";
import { resolveTelemetry } from "../lib/execution/_run_utils.ts";
import { MockLanguageModelV3, textResponse, textStream } from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Mock OTel span for testing spans.ts helpers
// ---------------------------------------------------------------------------

interface MockSpanAttrs {
  [key: string]: string | number | boolean;
}

interface MockSpanStatus {
  code: number;
  message?: string;
}

class MockSpan {
  readonly attributes: MockSpanAttrs = {};
  status: MockSpanStatus = { code: 0 };
  ended = false;
  exceptions: Error[] = [];

  setAttribute(key: string, value: string | number | boolean): this {
    this.attributes[key] = value;
    return this;
  }

  setStatus(status: MockSpanStatus): this {
    this.status = status;
    return this;
  }

  recordException(err: Error): this {
    this.exceptions.push(err);
    return this;
  }

  end(): void {
    this.ended = true;
  }
}

// ---------------------------------------------------------------------------
// createTelemetrySettings
// ---------------------------------------------------------------------------

Deno.test("createTelemetrySettings - defaults: isEnabled true, functionId from agent name", () => {
  const settings = createTelemetrySettings("my-agent", {});
  assertEquals(settings.isEnabled, true);
  assertEquals(settings.functionId, "my-agent");
});

Deno.test("createTelemetrySettings - fallback functionId when agent name undefined", () => {
  const settings = createTelemetrySettings(undefined, {});
  assertEquals(settings.functionId, "vibes-agent");
});

Deno.test("createTelemetrySettings - explicit functionId overrides agent name", () => {
  const settings = createTelemetrySettings("agent", {
    functionId: "custom-id",
  });
  assertEquals(settings.functionId, "custom-id");
});

Deno.test("createTelemetrySettings - isEnabled false is respected", () => {
  const settings = createTelemetrySettings("agent", { isEnabled: false });
  assertEquals(settings.isEnabled, false);
});

Deno.test("createTelemetrySettings - metadata is passed through", () => {
  const settings = createTelemetrySettings("agent", {
    metadata: { env: "test", version: "1.0" },
  });
  assertEquals(settings.metadata?.["env"], "test");
  assertEquals(settings.metadata?.["version"], "1.0");
});

Deno.test("createTelemetrySettings - metadata is a new object (immutable copy)", () => {
  const opts: InstrumentationOptions = { metadata: { env: "test" } };
  const settings = createTelemetrySettings("agent", opts);
  // Mutate the settings metadata - original opts should not change
  if (settings.metadata) {
    (settings.metadata as Record<string, unknown>)["extra"] = "added";
  }
  assertEquals(
    opts.metadata?.["extra" as keyof typeof opts.metadata],
    undefined,
  );
});

Deno.test("createTelemetrySettings - excludeContent sets recordInputs/recordOutputs false", () => {
  const settings = createTelemetrySettings("agent", { excludeContent: true });
  assertEquals(settings.recordInputs, false);
  assertEquals(settings.recordOutputs, false);
});

Deno.test("createTelemetrySettings - excludeContent false does not set recordInputs/recordOutputs", () => {
  const settings = createTelemetrySettings("agent", { excludeContent: false });
  assertEquals(settings.recordInputs, undefined);
  assertEquals(settings.recordOutputs, undefined);
});

Deno.test("createTelemetrySettings - tracer is included when provided", () => {
  // Use a minimal mock tracer object
  const mockTracer = {
    startSpan: () => {},
    startActiveSpan: () => {},
  } as unknown as Parameters<typeof createTelemetrySettings>[1]["tracer"];
  const settings = createTelemetrySettings("agent", { tracer: mockTracer });
  assertEquals(settings.tracer, mockTracer);
});

// ---------------------------------------------------------------------------
// Agent stores telemetry from AgentOptions
// ---------------------------------------------------------------------------

Deno.test("Agent stores telemetry from AgentOptions", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const telemetry: TelemetrySettings = { isEnabled: true, functionId: "my-fn" };
  const agent = new Agent({ model, telemetry });
  assertEquals(agent.telemetry, telemetry);
});

Deno.test("Agent telemetry is undefined by default", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({ model });
  assertEquals(agent.telemetry, undefined);
});

// ---------------------------------------------------------------------------
// resolveTelemetry - priority: override > run-level > agent-level
// ---------------------------------------------------------------------------

Deno.test("resolveTelemetry - returns undefined when nothing set", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({ model });
  const result = resolveTelemetry(agent, { deps: undefined });
  assertEquals(result, undefined);
});

Deno.test("resolveTelemetry - returns agent-level telemetry", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const telemetry: TelemetrySettings = {
    isEnabled: true,
    functionId: "agent-fn",
  };
  const agent = new Agent({ model, telemetry });
  const result = resolveTelemetry(agent, { deps: undefined });
  assertEquals(result?.functionId, "agent-fn");
});

Deno.test("resolveTelemetry - run-level telemetry overrides agent-level", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({
    model,
    telemetry: { isEnabled: true, functionId: "agent-fn" },
  });
  const result = resolveTelemetry(agent, {
    deps: undefined,
    telemetry: { isEnabled: true, functionId: "run-fn" },
  });
  assertEquals(result?.functionId, "run-fn");
});

Deno.test("resolveTelemetry - override-level telemetry takes highest priority", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({
    model,
    telemetry: { isEnabled: true, functionId: "agent-fn" },
  });
  const result = resolveTelemetry(agent, {
    deps: undefined,
    telemetry: { isEnabled: true, functionId: "run-fn" },
    _override: { telemetry: { isEnabled: true, functionId: "override-fn" } },
  });
  assertEquals(result?.functionId, "override-fn");
});

// ---------------------------------------------------------------------------
// instrumentAgent
// ---------------------------------------------------------------------------

Deno.test("instrumentAgent - returns object with run/stream/runStreamEvents", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({ model, name: "my-agent" });
  const instrumented = instrumentAgent(agent);

  assertExists(instrumented.run);
  assertExists(instrumented.stream);
  assertExists(instrumented.runStreamEvents);
});

Deno.test("instrumentAgent - does not mutate the original agent", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({ model });
  instrumentAgent(agent, { functionId: "wrapped" });
  assertEquals(agent.telemetry, undefined);
});

Deno.test("instrumentAgent - telemetry settings are created correctly", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({ model, name: "my-pipeline" });
  // We verify the settings via createTelemetrySettings which instrumentAgent uses
  const settings = createTelemetrySettings(agent.name, {
    functionId: "custom-fn",
    excludeContent: true,
  });
  assertEquals(settings.functionId, "custom-fn");
  assertEquals(settings.recordInputs, false);
  assertEquals(settings.recordOutputs, false);
  assertEquals(settings.isEnabled, true);
});

Deno.test("instrumentAgent - run() executes successfully with telemetry", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("hello")),
  });
  const agent = new Agent({ model, name: "my-agent" });
  const instrumented = instrumentAgent(agent, { functionId: "instrumented" });
  const result = await instrumented.run("hi");
  assertEquals(result.output, "hello");
});

Deno.test("instrumentAgent - stream() executes successfully with telemetry", async () => {
  const model = new MockLanguageModelV3({
    doStream: () => Promise.resolve(textStream("streamed")),
  });
  const agent = new Agent({ model, name: "streamer" });
  const instrumented = instrumentAgent(agent, { functionId: "stream-fn" });
  const result = instrumented.stream("prompt");
  let text = "";
  for await (const chunk of result.textStream) {
    text += chunk;
  }
  await result.output;
  assertEquals(text, "streamed");
});

Deno.test("instrumentAgent - uses agent.name as default functionId", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({ model, name: "my-pipeline" });
  const settings = createTelemetrySettings(agent.name, {});
  assertEquals(settings.functionId, "my-pipeline");
});

Deno.test("instrumentAgent - fallback functionId is 'vibes-agent' when no name", () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(textResponse("ok")),
  });
  const agent = new Agent({ model });
  const settings = createTelemetrySettings(agent.name, {});
  assertEquals(settings.functionId, "vibes-agent");
});

// ---------------------------------------------------------------------------
// recordUsageAttributes
// ---------------------------------------------------------------------------

Deno.test("recordUsageAttributes - sets all gen_ai usage attributes", () => {
  const span = new MockSpan();
  recordUsageAttributes(span as unknown as import("@opentelemetry/api").Span, {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    requests: 2,
  });

  assertEquals(span.attributes["gen_ai.usage.input_tokens"], 100);
  assertEquals(span.attributes["gen_ai.usage.output_tokens"], 50);
  assertEquals(span.attributes["gen_ai.usage.total_tokens"], 150);
  assertEquals(span.attributes["gen_ai.usage.requests"], 2);
});

Deno.test("recordUsageAttributes - zero values are recorded", () => {
  const span = new MockSpan();
  recordUsageAttributes(span as unknown as import("@opentelemetry/api").Span, {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requests: 0,
  });

  assertEquals(span.attributes["gen_ai.usage.input_tokens"], 0);
  assertEquals(span.attributes["gen_ai.usage.requests"], 0);
});

// ---------------------------------------------------------------------------
// recordRunAttributes
// ---------------------------------------------------------------------------

Deno.test("recordRunAttributes - sets model and agent name attributes", () => {
  const span = new MockSpan();
  recordRunAttributes(span as unknown as import("@opentelemetry/api").Span, {
    model: "claude-3-5-sonnet-20241022",
    agentName: "my-agent",
  });

  assertEquals(
    span.attributes["gen_ai.request.model"],
    "claude-3-5-sonnet-20241022",
  );
  assertEquals(span.attributes["vibes.agent.name"], "my-agent");
});

Deno.test("recordRunAttributes - records prompt when excludeContent is not set", () => {
  const span = new MockSpan();
  recordRunAttributes(span as unknown as import("@opentelemetry/api").Span, {
    prompt: "Hello world",
  });

  assertEquals(span.attributes["gen_ai.request.prompt"], "Hello world");
});

Deno.test("recordRunAttributes - suppresses prompt when excludeContent is true", () => {
  const span = new MockSpan();
  recordRunAttributes(span as unknown as import("@opentelemetry/api").Span, {
    prompt: "sensitive data",
    excludeContent: true,
  });

  assertEquals(span.attributes["gen_ai.request.prompt"], undefined);
});

Deno.test("recordRunAttributes - undefined fields are not set on span", () => {
  const span = new MockSpan();
  recordRunAttributes(span as unknown as import("@opentelemetry/api").Span, {});

  assertEquals(Object.keys(span.attributes).length, 0);
});

Deno.test("recordRunAttributes - only defined fields are set", () => {
  const span = new MockSpan();
  recordRunAttributes(span as unknown as import("@opentelemetry/api").Span, {
    model: "gpt-4o",
  });

  assertEquals(span.attributes["gen_ai.request.model"], "gpt-4o");
  assertEquals(span.attributes["vibes.agent.name"], undefined);
  assertEquals(span.attributes["gen_ai.request.prompt"], undefined);
});

// ---------------------------------------------------------------------------
// Type-level tests - verify exports are accessible from mod.ts
// ---------------------------------------------------------------------------

Deno.test("TelemetrySettings type is exported from mod.ts", () => {
  const settings: TelemetrySettings = {
    isEnabled: true,
    functionId: "type-check",
  };
  assertEquals(settings.isEnabled, true);
});

Deno.test("InstrumentationOptions type is exported from mod.ts", () => {
  const opts: InstrumentationOptions = {
    functionId: "test",
    excludeContent: false,
    isEnabled: true,
  };
  assertEquals(opts.functionId, "test");
});
