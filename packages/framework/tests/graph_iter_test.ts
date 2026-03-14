import { assertEquals, assertRejects } from "@std/assert";
import {
	BaseNode,
	Graph,
	GraphRun,
	MaxGraphIterationsError,
	next,
	output,
} from "../mod.ts";
import type { NodeResult } from "../mod.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface StepState {
	steps: string[];
}

class NodeA extends BaseNode<StepState, string[]> {
	readonly id = "a";
	readonly nextNodes = ["b"];

	async run(state: StepState): Promise<NodeResult<StepState, string[]>> {
		return next("b", { steps: [...state.steps, "a"] });
	}
}

class NodeB extends BaseNode<StepState, string[]> {
	readonly id = "b";
	readonly nextNodes = ["c"];

	async run(state: StepState): Promise<NodeResult<StepState, string[]>> {
		return next("c", { steps: [...state.steps, "b"] });
	}
}

class NodeC extends BaseNode<StepState, string[]> {
	readonly id = "c";

	async run(state: StepState): Promise<NodeResult<StepState, string[]>> {
		const final = [...state.steps, "c"];
		return output(final);
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("GraphRun - step through nodes one at a time", async () => {
	const graph = new Graph<StepState, string[]>([
		new NodeA(),
		new NodeB(),
		new NodeC(),
	]);

	const run = graph.runIter({ steps: [] }, "a");

	// First step: execute "a", transition to "b"
	const step1 = await run.next();
	assertEquals(step1?.kind, "node");
	if (step1?.kind === "node") {
		assertEquals(step1.nodeId, "b");
		assertEquals(step1.state.steps, ["a"]);
	}

	// Second step: execute "b", transition to "c"
	const step2 = await run.next();
	assertEquals(step2?.kind, "node");
	if (step2?.kind === "node") {
		assertEquals(step2.nodeId, "c");
		assertEquals(step2.state.steps, ["a", "b"]);
	}

	// Third step: execute "c", emit output
	const step3 = await run.next();
	assertEquals(step3?.kind, "output");
	if (step3?.kind === "output") {
		assertEquals(step3.output, ["a", "b", "c"]);
	}

	// After done, next() returns null
	const step4 = await run.next();
	assertEquals(step4, null);
});

Deno.test("GraphRun - returns null immediately after output", async () => {
	class ImmediateOutput extends BaseNode<StepState, string[]> {
		readonly id = "immediate";
		async run(_state: StepState): Promise<NodeResult<StepState, string[]>> {
			return output(["done"]);
		}
	}

	const graph = new Graph<StepState, string[]>([new ImmediateOutput()]);
	const run = graph.runIter({ steps: [] }, "immediate");

	const step1 = await run.next();
	assertEquals(step1?.kind, "output");

	const step2 = await run.next();
	assertEquals(step2, null);

	const step3 = await run.next();
	assertEquals(step3, null);
});

Deno.test("GraphRun - detects cycle via maxIterations", async () => {
	class CycleNode extends BaseNode<StepState, string[]> {
		readonly id = "cycle";
		async run(state: StepState): Promise<NodeResult<StepState, string[]>> {
			return next("cycle", state);
		}
	}

	const graph = new Graph<StepState, string[]>([new CycleNode()], {
		maxIterations: 3,
	});
	const run = graph.runIter({ steps: [] }, "cycle");

	// First 3 visits succeed
	await run.next(); // visit 1
	await run.next(); // visit 2
	await run.next(); // visit 3

	// 4th visit exceeds limit
	await assertRejects(
		() => run.next(),
		MaxGraphIterationsError,
	);
});

Deno.test("GraphRun - collect all steps via loop", async () => {
	const graph = new Graph<StepState, string[]>([
		new NodeA(),
		new NodeB(),
		new NodeC(),
	]);

	const run = graph.runIter({ steps: [] }, "a");
	const nodeIds: string[] = [];
	let finalOutput: string[] | null = null;

	let step = await run.next();
	while (step !== null) {
		if (step.kind === "node") {
			nodeIds.push(step.nodeId);
		} else {
			finalOutput = step.output;
		}
		step = await run.next();
	}

	// Transitions: a->b, b->c, then output
	assertEquals(nodeIds, ["b", "c"]);
	assertEquals(finalOutput, ["a", "b", "c"]);
});

Deno.test("GraphRun - state is immutable between steps", async () => {
	const graph = new Graph<StepState, string[]>([
		new NodeA(),
		new NodeB(),
		new NodeC(),
	]);

	const initialState: StepState = { steps: [] };
	const run = graph.runIter(initialState, "a");

	const step1 = await run.next();
	// Original state should be unchanged
	assertEquals(initialState.steps, []);
	if (step1?.kind === "node") {
		assertEquals(step1.state.steps, ["a"]);
	}
});

Deno.test("GraphRun - returned from Graph.runIter", () => {
	const graph = new Graph<StepState, string[]>([new NodeA()]);
	const run = graph.runIter({ steps: [] }, "a");
	assertEquals(run instanceof GraphRun, true);
});
