import { assertEquals, assertRejects } from "@std/assert";
import {
	BaseNode,
	Graph,
	MaxGraphIterationsError,
	UnknownNodeError,
	next,
	output,
} from "../mod.ts";
import type { NodeResult } from "../mod.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface CountState {
	count: number;
}

/** Increments count, transitions to "double" if count < 3, else ends */
class IncrementNode extends BaseNode<CountState, number> {
	readonly id = "increment";
	readonly nextNodes = ["double", "done"];

	async run(state: CountState): Promise<NodeResult<CountState, number>> {
		const newState = { count: state.count + 1 };
		if (newState.count < 3) {
			return next("double", newState);
		}
		return output(newState.count);
	}
}

/** Doubles count, always transitions back to "increment" */
class DoubleNode extends BaseNode<CountState, number> {
	readonly id = "double";
	readonly nextNodes = ["increment"];

	async run(state: CountState): Promise<NodeResult<CountState, number>> {
		return next("increment", { count: state.count * 2 });
	}
}

/** Immediately emits output */
class TerminalNode extends BaseNode<CountState, number> {
	readonly id = "terminal";

	async run(state: CountState): Promise<NodeResult<CountState, number>> {
		return output(state.count * 10);
	}
}

/** Infinite loop: always transitions to itself */
class LoopNode extends BaseNode<CountState, number> {
	readonly id = "loop";
	readonly nextNodes = ["loop"];

	async run(state: CountState): Promise<NodeResult<CountState, number>> {
		return next("loop", state);
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("Graph - runs to completion and returns output", async () => {
	const graph = new Graph<CountState, number>([
		new IncrementNode(),
		new DoubleNode(),
	]);

	// Start at count=1 -> increment -> count=2, < 3 so -> double -> count=4
	// -> increment -> count=5, >= 3 so -> output(5)
	const result = await graph.run({ count: 1 }, "increment");
	assertEquals(result, 5);
});

Deno.test("Graph - single node terminal immediately", async () => {
	const graph = new Graph<CountState, number>([new TerminalNode()]);
	const result = await graph.run({ count: 7 }, "terminal");
	assertEquals(result, 70);
});

Deno.test("Graph - throws UnknownNodeError for missing start node", async () => {
	const graph = new Graph<CountState, number>([new TerminalNode()]);
	await assertRejects(
		() => graph.run({ count: 0 }, "nonexistent"),
		UnknownNodeError,
		'"nonexistent"',
	);
});

Deno.test("Graph - throws UnknownNodeError for missing transition target", async () => {
	class BadTransitionNode extends BaseNode<CountState, number> {
		readonly id = "bad";
		async run(_state: CountState): Promise<NodeResult<CountState, number>> {
			return next("does_not_exist", { count: 0 });
		}
	}

	const graph = new Graph<CountState, number>([new BadTransitionNode()]);
	await assertRejects(
		() => graph.run({ count: 0 }, "bad"),
		UnknownNodeError,
		'"does_not_exist"',
	);
});

Deno.test("Graph - throws MaxGraphIterationsError on cycle", async () => {
	const graph = new Graph<CountState, number>([new LoopNode()], {
		maxIterations: 5,
	});
	await assertRejects(
		() => graph.run({ count: 0 }, "loop"),
		MaxGraphIterationsError,
	);
});

Deno.test("Graph - respects custom maxIterations", async () => {
	// With maxIterations=1, the loop node should fail on second visit
	const graph = new Graph<CountState, number>([new LoopNode()], {
		maxIterations: 1,
	});
	await assertRejects(
		() => graph.run({ count: 0 }, "loop"),
		MaxGraphIterationsError,
	);
});

Deno.test("Graph - toMermaid includes all nodes", () => {
	const graph = new Graph<CountState, number>([
		new IncrementNode(),
		new DoubleNode(),
		new TerminalNode(),
	]);
	const diagram = graph.toMermaid();
	assertEquals(diagram.includes("flowchart TD"), true);
	assertEquals(diagram.includes("increment"), true);
	assertEquals(diagram.includes("double"), true);
	assertEquals(diagram.includes("terminal"), true);
});

Deno.test("Graph - toMermaid includes edges when nextNodes declared", () => {
	const graph = new Graph<CountState, number>([
		new IncrementNode(),
		new DoubleNode(),
	]);
	const diagram = graph.toMermaid();
	assertEquals(diagram.includes("increment --> double"), true);
	assertEquals(diagram.includes("increment --> done"), true);
	assertEquals(diagram.includes("double --> increment"), true);
});

Deno.test("Graph - immutable state (nodes return new state objects)", async () => {
	const captured: CountState[] = [];

	class CaptureNode extends BaseNode<CountState, number> {
		readonly id = "capture";
		async run(state: CountState): Promise<NodeResult<CountState, number>> {
			captured.push(state);
			if (state.count >= 2) {
				return output(state.count);
			}
			// Return NEW state object, not mutated original
			return next("capture", { count: state.count + 1 });
		}
	}

	const graph = new Graph<CountState, number>([new CaptureNode()]);
	await graph.run({ count: 0 }, "capture");

	// Each captured state should be a distinct object
	assertEquals(captured.length, 3); // count 0, 1, 2
	assertEquals(captured[0].count, 0);
	assertEquals(captured[1].count, 1);
	assertEquals(captured[2].count, 2);
	// Verify they're distinct objects
	assertEquals(captured[0] !== captured[1], true);
	assertEquals(captured[1] !== captured[2], true);
});

Deno.test("Graph - multiple nodes in sequence", async () => {
	interface PipelineState {
		value: string;
	}

	class Step1 extends BaseNode<PipelineState, string> {
		readonly id = "step1";
		readonly nextNodes = ["step2"];
		async run(state: PipelineState): Promise<NodeResult<PipelineState, string>> {
			return next("step2", { value: state.value + "_step1" });
		}
	}

	class Step2 extends BaseNode<PipelineState, string> {
		readonly id = "step2";
		readonly nextNodes = ["step3"];
		async run(state: PipelineState): Promise<NodeResult<PipelineState, string>> {
			return next("step3", { value: state.value + "_step2" });
		}
	}

	class Step3 extends BaseNode<PipelineState, string> {
		readonly id = "step3";
		async run(state: PipelineState): Promise<NodeResult<PipelineState, string>> {
			return output(state.value + "_step3");
		}
	}

	const graph = new Graph<PipelineState, string>([
		new Step1(),
		new Step2(),
		new Step3(),
	]);
	const result = await graph.run({ value: "start" }, "step1");
	assertEquals(result, "start_step1_step2_step3");
});
