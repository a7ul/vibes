export class MaxTurnsError extends Error {
  constructor(turns: number) {
    super(`Agent exceeded maxTurns (${turns})`);
    this.name = "MaxTurnsError";
  }
}

export class MaxRetriesError extends Error {
  constructor(retries: number, cause?: Error) {
    super(`Result validation failed after ${retries} retries: ${cause?.message}`);
    this.name = "MaxRetriesError";
    this.cause = cause;
  }
}
