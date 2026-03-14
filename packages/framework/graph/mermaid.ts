// ---------------------------------------------------------------------------
// Graph FSM — Mermaid diagram generation
// ---------------------------------------------------------------------------

import type { NodeId } from "./types.ts";
import type { BaseNode } from "./node.ts";

/** Duck-typed extension of BaseNode that optionally declares static edges. */
interface NodeWithEdges {
	readonly id: string;
	readonly nextNodes?: NodeId[];
}

/**
 * Generate a Mermaid flowchart string from a list of graph nodes.
 *
 * If nodes declare `nextNodes?: NodeId[]`, edges are included.
 * Start/end nodes (those with id "start" or "end") use stadium shape `([id])`.
 * All other nodes use rectangle shape `[id]`.
 *
 * Example output:
 * ```
 * flowchart TD
 *   start([start])
 *   process[process]
 *   end_node([end_node])
 *   start --> process
 *   process --> end_node
 * ```
 */
export function toMermaid<TState, TOutput>(
	nodes: BaseNode<TState, TOutput>[],
): string {
	const lines: string[] = ["flowchart TD"];

	// Cast to access optional nextNodes property without TypeScript errors
	const nodesWithEdges = nodes as unknown as NodeWithEdges[];

	// Node declarations
	for (const node of nodesWithEdges) {
		const isTerminal =
			node.id === "start" || node.id === "end" || node.id.endsWith("_end");
		const label = isTerminal ? `([${node.id}])` : `[${node.id}]`;
		lines.push(`  ${node.id}${label}`);
	}

	// Edge declarations (only if node declares nextNodes)
	for (const node of nodesWithEdges) {
		if (node.nextNodes && node.nextNodes.length > 0) {
			for (const targetId of node.nextNodes) {
				lines.push(`  ${node.id} --> ${targetId}`);
			}
		}
	}

	return lines.join("\n");
}
