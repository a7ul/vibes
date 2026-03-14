import type { Usage } from "./usage.ts";

export interface RunContext<TDeps = undefined> {
  /** User-supplied dependencies, injected at run time. */
  deps: TDeps;
  /** Cumulative token usage for this run so far. */
  usage: Usage;
  /** How many times the current result has been retried. */
  retryCount: number;
  /** Name of the tool currently executing, or null if in a system-prompt callback. */
  toolName: string | null;
  /** Unique identifier for this run. */
  runId: string;
}
