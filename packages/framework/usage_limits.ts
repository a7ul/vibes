import type { Usage } from "./types.ts";
import { UsageLimitError } from "./errors.ts";

/** Caps on cumulative usage for a single run. */
export interface UsageLimits {
	/** Maximum number of model requests (turns). */
	maxRequests?: number;
	/** Maximum input tokens consumed. */
	maxInputTokens?: number;
	/** Maximum output tokens generated. */
	maxOutputTokens?: number;
	/** Maximum total tokens (input + output). */
	maxTotalTokens?: number;
}

/**
 * Throws `UsageLimitError` if any limit is exceeded by the current usage.
 * Called before each model request in the turn loop.
 */
export function checkUsageLimits(limits: UsageLimits, usage: Usage): void {
	if (
		limits.maxRequests !== undefined &&
		usage.requests >= limits.maxRequests
	) {
		throw new UsageLimitError("requests", usage.requests, limits.maxRequests);
	}
	if (
		limits.maxInputTokens !== undefined &&
		usage.inputTokens >= limits.maxInputTokens
	) {
		throw new UsageLimitError(
			"inputTokens",
			usage.inputTokens,
			limits.maxInputTokens,
		);
	}
	if (
		limits.maxOutputTokens !== undefined &&
		usage.outputTokens >= limits.maxOutputTokens
	) {
		throw new UsageLimitError(
			"outputTokens",
			usage.outputTokens,
			limits.maxOutputTokens,
		);
	}
	if (
		limits.maxTotalTokens !== undefined &&
		usage.totalTokens >= limits.maxTotalTokens
	) {
		throw new UsageLimitError(
			"totalTokens",
			usage.totalTokens,
			limits.maxTotalTokens,
		);
	}
}
