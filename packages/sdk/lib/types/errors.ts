/** Thrown when an agent run exceeds the configured `maxTurns` limit. */
export class MaxTurnsError extends Error {
  constructor(turns: number) {
    super(`Agent exceeded maxTurns (${turns})`);
    this.name = "MaxTurnsError";
  }
}

/** Thrown when result validation fails after exhausting all configured retries. */
export class MaxRetriesError extends Error {
  constructor(retries: number, cause?: Error) {
    super(
      `Result validation failed after ${retries} retries: ${cause?.message}`,
    );
    this.name = "MaxRetriesError";
    this.cause = cause;
  }
}

/** Thrown when a token or request usage limit is exceeded during a run. */
export class UsageLimitError extends Error {
  constructor(
    public readonly limitKind:
      | "requests"
      | "inputTokens"
      | "outputTokens"
      | "totalTokens",
    public readonly current: number,
    public readonly limit: number,
  ) {
    super(
      `Usage limit exceeded: ${limitKind} reached ${current} (limit: ${limit})`,
    );
    this.name = "UsageLimitError";
  }
}

/** Thrown when a real model request is attempted while `setAllowModelRequests(false)` is active. */
export class ModelRequestsDisabledError extends Error {
  constructor() {
    super(
      "Model requests are disabled. Use setAllowModelRequests(true) or agent.override({ model }) in tests.",
    );
    this.name = "ModelRequestsDisabledError";
  }
}

/**
 * Thrown when one or more tool calls require human approval before execution.
 *
 * Callers should catch this error, inspect `deferred.requests`, supply
 * approval results, then call `agent.resume(deferred, results)` to continue.
 */
export class ApprovalRequiredError extends Error {
  readonly deferred: import("../execution/deferred.ts").DeferredToolRequests;

  constructor(
    deferred: import("../execution/deferred.ts").DeferredToolRequests,
  ) {
    super(
      `Approval required for ${deferred.requests.length} tool call(s): ${
        deferred.requests.map((r) => r.toolName).join(", ")
      }`,
    );
    this.name = "ApprovalRequiredError";
    this.deferred = deferred;
  }
}
