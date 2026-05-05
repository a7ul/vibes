/**
 * Shared OpenTelemetry types for the vibes agent framework.
 *
 * The framework delegates span creation to the Vercel AI SDK's built-in
 * `experimental_telemetry` support on `generateText` / `streamText`. We
 * re-export the AI SDK's own `TelemetrySettings` type to ensure perfect
 * type compatibility when the settings are threaded through to the SDK calls.
 */
import type { Tracer } from "@opentelemetry/api";

// ---------------------------------------------------------------------------
// TelemetrySettings - re-exported from AI SDK for public API surface
// ---------------------------------------------------------------------------

/**
 * Telemetry configuration passed to each `generateText` / `streamText` call
 * as `experimental_telemetry`. When enabled, the AI SDK creates spans for the
 * model call and every tool invocation automatically.
 *
 * This is a re-export of the AI SDK's `TelemetrySettings` type to ensure
 * type compatibility with the underlying `generateText` / `streamText` options.
 */
export type { TelemetrySettings } from "ai";

// ---------------------------------------------------------------------------
// ToolCallOtelMetadata - typed hints for OTel tool call rendering
// ---------------------------------------------------------------------------

/**
 * Typed metadata that can be attached to a `ToolDefinition` via the
 * `otelMetadata` field to inform OpenTelemetry event rendering.
 *
 * Used by observability tools (e.g. Logfire) for rendering hints such as
 * syntax highlighting of code arguments in tool call spans.
 *
 * Equivalent to Pydantic AI's `ToolCallPartOtelMetadata` (v1.90.0).
 *
 * @example
 * ```ts
 * const runCode = tool({
 *   name: "run_python",
 *   description: "Execute Python code",
 *   parameters: z.object({ code: z.string() }),
 *   otelMetadata: { codeArgName: "code", codeArgLanguage: "python" },
 *   execute: async (ctx, { code }) => execPython(code),
 * });
 * ```
 */
export interface ToolCallOtelMetadata {
  /**
   * The name of the tool argument that contains code.
   * When set, observability UIs can apply syntax highlighting to this argument.
   */
  codeArgName?: string;
  /**
   * The programming language of the code in `codeArgName`.
   * Examples: `"python"`, `"javascript"`, `"sql"`, `"bash"`.
   */
  codeArgLanguage?: string;
}

// ---------------------------------------------------------------------------
// InstrumentationOptions - passed to instrumentAgent()
// ---------------------------------------------------------------------------

/**
 * Options for the `instrumentAgent()` helper.
 *
 * The helper wraps an existing agent so that every `run()` / `stream()` call
 * automatically enables AI-SDK-level telemetry without requiring callers to
 * pass `telemetry` on every invocation.
 */
export interface InstrumentationOptions {
  /**
   * A stable identifier for the agent being traced. Defaults to the agent's
   * `name` property when available, or `"vibes-agent"`.
   */
  functionId?: string;
  /**
   * Arbitrary metadata added to every span as key-value attributes.
   * Must be primitive values compatible with OpenTelemetry's `AttributeValue`.
   */
  metadata?: Record<string, string | number | boolean>;
  /**
   * When `true`, prompt content and model responses are NOT recorded in span
   * attributes. Useful for compliance / privacy requirements.
   *
   * Maps to the AI SDK's `recordInputs: false` / `recordOutputs: false`
   * telemetry settings.
   */
  excludeContent?: boolean;
  /**
   * Whether telemetry is enabled. Defaults to `true` when passed to
   * `instrumentAgent()`.
   */
  isEnabled?: boolean;
  /**
   * An explicit `Tracer` instance. When omitted the AI SDK resolves one from
   * the global OpenTelemetry `TracerProvider`.
   */
  tracer?: Tracer;
}
