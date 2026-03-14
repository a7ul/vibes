// ---------------------------------------------------------------------------
// Graph FSM — errors
// ---------------------------------------------------------------------------

import type { NodeId } from "./types.ts";

/** Thrown when the graph visits the same node too many times (likely a cycle). */
export class MaxGraphIterationsError extends Error {
  constructor(nodeId: NodeId, iterations: number) {
    super(
      `Graph exceeded max iterations (${iterations}) at node "${nodeId}". Possible infinite cycle.`,
    );
    this.name = "MaxGraphIterationsError";
  }
}

/** Thrown when a node ID referenced in a transition is not registered in the graph. */
export class UnknownNodeError extends Error {
  constructor(nodeId: NodeId) {
    super(`Graph has no node registered with id "${nodeId}".`);
    this.name = "UnknownNodeError";
  }
}
