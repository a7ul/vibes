/** Token usage accumulated across all turns in a run. */
export interface Usage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	requests: number;
}

export function createUsage(): Usage {
	return { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
}
