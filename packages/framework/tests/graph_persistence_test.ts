import { assertEquals } from "@std/assert";
import {
	BaseNode,
	Graph,
	MemoryStatePersistence,
	FileStatePersistence,
	next,
	output,
} from "../mod.ts";
import type { NodeResult } from "../mod.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface WorkflowState {
	step: number;
	data: string;
}

/** Progresses through steps 0->1->2->done */
class WorkflowNode extends BaseNode<WorkflowState, string> {
	readonly id = "workflow";

	async run(state: WorkflowState): Promise<NodeResult<WorkflowState, string>> {
		if (state.step >= 2) {
			return output(`done:${state.data}`);
		}
		return next("workflow", {
			step: state.step + 1,
			data: state.data + `_step${state.step + 1}`,
		});
	}
}

// ---------------------------------------------------------------------------
// MemoryStatePersistence tests
// ---------------------------------------------------------------------------

Deno.test("MemoryStatePersistence - save and load", async () => {
	const persistence = new MemoryStatePersistence<WorkflowState>();

	await persistence.save("run1", "workflow", { step: 1, data: "hello" });
	const snapshot = await persistence.load("run1");

	assertEquals(snapshot?.nodeId, "workflow");
	assertEquals(snapshot?.state.step, 1);
	assertEquals(snapshot?.state.data, "hello");
});

Deno.test("MemoryStatePersistence - load returns null when no state", async () => {
	const persistence = new MemoryStatePersistence<WorkflowState>();
	const snapshot = await persistence.load("no-such-id");
	assertEquals(snapshot, null);
});

Deno.test("MemoryStatePersistence - clear removes state", async () => {
	const persistence = new MemoryStatePersistence<WorkflowState>();

	await persistence.save("run1", "workflow", { step: 1, data: "hello" });
	await persistence.clear("run1");

	const snapshot = await persistence.load("run1");
	assertEquals(snapshot, null);
});

Deno.test("MemoryStatePersistence - multiple graph IDs are independent", async () => {
	const persistence = new MemoryStatePersistence<WorkflowState>();

	await persistence.save("runA", "nodeA", { step: 1, data: "a" });
	await persistence.save("runB", "nodeB", { step: 2, data: "b" });

	const snapshotA = await persistence.load("runA");
	const snapshotB = await persistence.load("runB");

	assertEquals(snapshotA?.nodeId, "nodeA");
	assertEquals(snapshotA?.state.data, "a");
	assertEquals(snapshotB?.nodeId, "nodeB");
	assertEquals(snapshotB?.state.data, "b");
});

Deno.test("MemoryStatePersistence - overwrite updates existing state", async () => {
	const persistence = new MemoryStatePersistence<WorkflowState>();

	await persistence.save("run1", "nodeA", { step: 1, data: "old" });
	await persistence.save("run1", "nodeB", { step: 2, data: "new" });

	const snapshot = await persistence.load("run1");
	assertEquals(snapshot?.nodeId, "nodeB");
	assertEquals(snapshot?.state.data, "new");
});

// ---------------------------------------------------------------------------
// Graph + MemoryStatePersistence integration
// ---------------------------------------------------------------------------

Deno.test("Graph - resumes from persisted state", async () => {
	const persistence = new MemoryStatePersistence<WorkflowState>();
	const graph = new Graph<WorkflowState, string>([new WorkflowNode()]);

	// Manually save state as if first two steps already ran
	await persistence.save("my-run", "workflow", { step: 2, data: "pre_step1_step2" });

	// Now run with persistence — should resume from step=2 and immediately output
	const result = await graph.run(
		{ step: 0, data: "pre" }, // initial state ignored when persistence has saved state
		"workflow",
		{ persistence, graphId: "my-run" },
	);

	assertEquals(result, "done:pre_step1_step2");
});

Deno.test("Graph - clears persisted state on completion", async () => {
	const persistence = new MemoryStatePersistence<WorkflowState>();
	const graph = new Graph<WorkflowState, string>([new WorkflowNode()]);

	await graph.run({ step: 0, data: "start" }, "workflow", {
		persistence,
		graphId: "my-run",
	});

	// After completion, persisted state should be cleared
	const snapshot = await persistence.load("my-run");
	assertEquals(snapshot, null);
});

Deno.test("Graph - saves state after each node transition", async () => {
	const savedStates: Array<{ nodeId: string; step: number }> = [];

	// Spy persistence
	const persistence: MemoryStatePersistence<WorkflowState> & {
		save(
			graphId: string,
			nodeId: string,
			state: WorkflowState,
		): Promise<void>;
	} = new MemoryStatePersistence<WorkflowState>();
	const originalSave = persistence.save.bind(persistence);
	persistence.save = async (graphId, nodeId, state) => {
		savedStates.push({ nodeId, step: state.step });
		return originalSave(graphId, nodeId, state);
	};

	const graph = new Graph<WorkflowState, string>([new WorkflowNode()]);
	await graph.run({ step: 0, data: "x" }, "workflow", {
		persistence,
		graphId: "track-run",
	});

	// Should have saved at step 1 and step 2 transitions (not after output)
	assertEquals(savedStates.length, 2);
	assertEquals(savedStates[0].step, 1);
	assertEquals(savedStates[1].step, 2);
});

Deno.test("Graph - runs normally without persistence", async () => {
	const graph = new Graph<WorkflowState, string>([new WorkflowNode()]);
	const result = await graph.run({ step: 0, data: "no-persist" }, "workflow");
	assertEquals(result, "done:no-persist_step1_step2");
});

// ---------------------------------------------------------------------------
// FileStatePersistence tests
// ---------------------------------------------------------------------------

Deno.test("FileStatePersistence - save, load, clear", async () => {
	const dir = await Deno.makeTempDir();

	try {
		const persistence = new FileStatePersistence<WorkflowState>(dir);

		await persistence.save("file-run", "workflow", { step: 1, data: "file-test" });
		const snapshot = await persistence.load("file-run");

		assertEquals(snapshot?.nodeId, "workflow");
		assertEquals(snapshot?.state.step, 1);
		assertEquals(snapshot?.state.data, "file-test");

		await persistence.clear("file-run");
		const cleared = await persistence.load("file-run");
		assertEquals(cleared, null);
	} finally {
		await Deno.remove(dir, { recursive: true });
	}
});

Deno.test("FileStatePersistence - load returns null for missing file", async () => {
	const dir = await Deno.makeTempDir();

	try {
		const persistence = new FileStatePersistence<WorkflowState>(dir);
		const snapshot = await persistence.load("nonexistent");
		assertEquals(snapshot, null);
	} finally {
		await Deno.remove(dir, { recursive: true });
	}
});

Deno.test("FileStatePersistence - clear on non-existent file is safe", async () => {
	const dir = await Deno.makeTempDir();

	try {
		const persistence = new FileStatePersistence<WorkflowState>(dir);
		// Should not throw
		await persistence.clear("does-not-exist");
	} finally {
		await Deno.remove(dir, { recursive: true });
	}
});

Deno.test("FileStatePersistence - graph run clears file on completion", async () => {
	const dir = await Deno.makeTempDir();

	try {
		const persistence = new FileStatePersistence<WorkflowState>(dir);
		const graph = new Graph<WorkflowState, string>([new WorkflowNode()]);

		await graph.run({ step: 0, data: "file" }, "workflow", {
			persistence,
			graphId: "file-complete-run",
		});

		const snapshot = await persistence.load("file-complete-run");
		assertEquals(snapshot, null);
	} finally {
		await Deno.remove(dir, { recursive: true });
	}
});
