// ---------------------------------------------------------------------------
// Graph FSM — BaseNode
// ---------------------------------------------------------------------------

import type { NodeId, NodeResult } from "./types.ts";

/**
 * Abstract base class for graph nodes.
 *
 * Extend this class and implement `id` and `run()`.
 * Optionally declare `nextNodes` for static Mermaid diagram generation.
 *
 * @template TState  The shared state type threaded through the graph.
 * @template TOutput The final output type emitted when the graph ends.
 */
export abstract class BaseNode<TState, TOutput = never> {
	/** Unique identifier for this node within the graph. */
	abstract readonly id: NodeId;

	/**
	 * Optional static list of node IDs this node may transition to.
	 * Used for Mermaid diagram generation only — not enforced at runtime.
	 *
	 * Declare this in a subclass to include edges in Mermaid output:
	 * ```ts
	 * readonly nextNodes = ["node-b", "node-c"];
	 * ```
	 */
	// Note: not declared here — subclasses freely add this property without override


	/**
	 * Execute this node's logic given the current state.
	 * Return `next(nodeId, newState)` to transition, or `output(value)` to end.
	 */
	abstract run(state: TState): Promise<NodeResult<TState, TOutput>>;
}
