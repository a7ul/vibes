/**
 * OpenTelemetry instrumentation for the vibes agent framework.
 *
 * @module
 */
export type {
  InstrumentationOptions,
  TelemetrySettings,
} from "./otel_types.ts";
export { createTelemetrySettings, instrumentAgent } from "./instrumentation.ts";
export {
  recordRunAttributes,
  recordUsageAttributes,
  withAgentSpan,
} from "./spans.ts";
