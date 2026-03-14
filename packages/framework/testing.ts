import type { ModelMessage } from "ai";
import { ModelRequestsDisabledError } from "./errors.ts";

// ---------------------------------------------------------------------------
// ALLOW_MODEL_REQUESTS guard
// ---------------------------------------------------------------------------

let _allowModelRequests = true;

/**
 * Allow or disallow real model API calls globally. Default: `true`.
 *
 * Set to `false` in test suites to ensure accidental non-mocked agent runs
 * throw `ModelRequestsDisabledError` immediately. Use `agent.override()` to
 * provide a mock model for the runs you do want to execute.
 *
 * @example
 * ```ts
 * import { setAllowModelRequests } from "./testing.ts";
 *
 * // At the top of your test file:
 * setAllowModelRequests(false);
 * ```
 */
export function setAllowModelRequests(allow: boolean): void {
	_allowModelRequests = allow;
}

/** Returns the current model-requests flag. */
export function getAllowModelRequests(): boolean {
	return _allowModelRequests;
}

/**
 * Throws `ModelRequestsDisabledError` if model requests are disabled and the
 * call is not explicitly bypassed (e.g. via `agent.override()`).
 *
 * @internal Called at the start of every `executeRun` / `executeStream`.
 */
export function assertModelRequestsAllowed(bypass = false): void {
	if (!_allowModelRequests && !bypass) {
		throw new ModelRequestsDisabledError();
	}
}

// ---------------------------------------------------------------------------
// captureRunMessages
// ---------------------------------------------------------------------------

let _captureStore: ModelMessage[][] | null = null;

/**
 * Runs `fn` and captures every message array sent to the model during the call.
 * Returns both the function's result and the captured message snapshots
 * (one entry per model call / turn).
 *
 * @example
 * ```ts
 * const { result, messages } = await captureRunMessages(() =>
 *   agent.run("hello")
 * );
 * // messages[0] = messages sent on turn 1, messages[1] = turn 2, …
 * ```
 */
export async function captureRunMessages<T>(
	fn: () => Promise<T>,
): Promise<{ result: T; messages: ModelMessage[][] }> {
	const store: ModelMessage[][] = [];
	_captureStore = store;
	try {
		const result = await fn();
		return { result, messages: store };
	} finally {
		_captureStore = null;
	}
}

/**
 * Called by execution internals before each model call to record the messages.
 * @internal
 */
export function _notifyModelRequest(messages: ModelMessage[]): void {
	if (_captureStore !== null) {
		_captureStore.push([...messages]);
	}
}
