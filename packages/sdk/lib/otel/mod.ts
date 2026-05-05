/**
 * OpenTelemetry instrumentation for the vibes agent framework.
 *
 * @module
 */
export type {
  InstrumentationOptions,
  TelemetrySettings,
  ToolCallOtelMetadata,
} from "./otel_types.ts";
export { createTelemetrySettings, instrumentAgent } from "./instrumentation.ts";
export {
  recordRunAttributes,
  recordUsageAttributes,
  withAgentSpan,
} from "./spans.ts";
