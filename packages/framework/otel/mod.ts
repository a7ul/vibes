/**
 * OpenTelemetry instrumentation for the vibes agent framework.
 *
 * @module
 */
export type { TelemetrySettings, InstrumentationOptions } from "./otel_types.ts";
export { createTelemetrySettings, instrumentAgent } from "./instrumentation.ts";
export {
	withAgentSpan,
	recordUsageAttributes,
	recordRunAttributes,
} from "./spans.ts";
