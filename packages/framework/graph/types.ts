// ---------------------------------------------------------------------------
// Graph FSM — core types
// ---------------------------------------------------------------------------

export type NodeId = string;

/**
 * The result of running a node:
 * - `{ kind: 'next', nodeId, state }` — transition to another node with new state
 * - `{ kind: 'output', output }` — graph is done, emit final output
 */
export type NodeResult<TState, TOutput> =
	| { readonly kind: "next"; readonly nodeId: NodeId; readonly state: TState }
	| { readonly kind: "output"; readonly output: TOutput };

/** Construct a "transition to next node" result. */
export function next<TState, TOutput>(
	nodeId: NodeId,
	state: TState,
): NodeResult<TState, TOutput> {
	return { kind: "next", nodeId, state };
}

/** Construct a "graph is done" result. */
export function output<TState, TOutput>(
	value: TOutput,
): NodeResult<TState, TOutput> {
	return { kind: "output", output: value };
}
