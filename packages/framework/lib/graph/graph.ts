// ---------------------------------------------------------------------------
// Graph FSM - Graph and GraphRun
// ---------------------------------------------------------------------------

import type { NodeId } from "./types.ts";
import type { BaseNode } from "./node.ts";
import type { StatePersistence } from "./persistence.ts";
import { MaxGraphIterationsError, UnknownNodeError } from "./errors.ts";
import { toMermaid } from "./mermaid.ts";

/** Options for `Graph.run()` and `Graph.runIter()`. */
export interface GraphRunOptions<TState> {
  /**
   * Pluggable persistence for resumable runs.
   * When provided alongside `graphId`, execution resumes from last saved state.
   */
  persistence?: StatePersistence<TState>;
  /**
   * Identifier for this graph run - required when using `persistence`.
   * Used as the key for saving/loading state.
   */
  graphId?: string;
}

/** Options for constructing a `Graph`. */
export interface GraphOptions {
  /**
   * Maximum number of times any single node may be visited before
   * `MaxGraphIterationsError` is thrown. Defaults to 100.
   */
  maxIterations?: number;
}

// ---------------------------------------------------------------------------
// GraphRun - step-by-step iterator
// ---------------------------------------------------------------------------

/** A step in a running graph - either a node transition or the final output. */
export type GraphStep<TState, TOutput> =
  | { readonly kind: "node"; readonly nodeId: NodeId; readonly state: TState }
  | { readonly kind: "output"; readonly output: TOutput };

/**
 * A handle for stepping through graph execution one node at a time.
 * Useful for human-in-the-loop workflows where you want to inspect or
 * modify state between node transitions.
 *
 * ```ts
 * const run = graph.runIter(initialState, "start");
 * let step = await run.next();
 * while (step !== null && step.kind === "node") {
 *   console.log("At node:", step.nodeId);
 *   step = await run.next();
 * }
 * if (step?.kind === "output") console.log("Done:", step.output);
 * ```
 */
export class GraphRun<TState, TOutput> {
  private currentNodeId: NodeId;
  private currentState: TState;
  private done = false;
  private finalOutput: TOutput | undefined = undefined;

  constructor(
    private readonly nodeMap: ReadonlyMap<NodeId, BaseNode<TState, TOutput>>,
    private readonly maxIterations: number,
    private readonly visitCounts: Map<NodeId, number>,
    startNodeId: NodeId,
    startState: TState,
    private readonly persistence?: StatePersistence<TState>,
    private readonly graphId?: string,
  ) {
    this.currentNodeId = startNodeId;
    this.currentState = startState;
  }

  /**
   * Execute the current node and advance one step.
   *
   * Returns:
   * - `{ kind: "node", nodeId, state }` - transitioned to next node
   * - `{ kind: "output", output }` - graph completed
   * - `null` - graph was already done before this call
   */
  async next(): Promise<GraphStep<TState, TOutput> | null> {
    if (this.done) {
      return null;
    }

    const node = this.nodeMap.get(this.currentNodeId);
    if (!node) {
      throw new UnknownNodeError(this.currentNodeId);
    }

    // Cycle detection
    const visits = (this.visitCounts.get(this.currentNodeId) ?? 0) + 1;
    if (visits > this.maxIterations) {
      throw new MaxGraphIterationsError(this.currentNodeId, this.maxIterations);
    }
    this.visitCounts.set(this.currentNodeId, visits);

    const result = await node.run(this.currentState);

    if (result.kind === "output") {
      this.done = true;
      this.finalOutput = result.output;

      // Clear persisted state on successful completion
      if (this.persistence && this.graphId) {
        await this.persistence.clear(this.graphId);
      }

      return { kind: "output", output: result.output };
    }

    // Transition
    this.currentNodeId = result.nodeId;
    this.currentState = result.state;

    // Persist state after each transition
    if (this.persistence && this.graphId) {
      await this.persistence.save(this.graphId, result.nodeId, result.state);
    }

    return { kind: "node", nodeId: result.nodeId, state: result.state };
  }
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/**
 * A typed finite-state machine that runs a set of `BaseNode` instances
 * to completion, threading shared state between them.
 *
 * ```ts
 * const graph = new Graph([new FetchNode(), new ProcessNode(), new StoreNode()]);
 * const output = await graph.run(initialState, "fetch");
 * ```
 *
 * @template TState  Shared mutable state passed between nodes.
 * @template TOutput Final output type produced when the graph ends.
 */
export class Graph<TState, TOutput = unknown> {
  private readonly nodeMap: Map<NodeId, BaseNode<TState, TOutput>>;
  private readonly nodes: BaseNode<TState, TOutput>[];
  private readonly maxIterations: number;

  constructor(
    nodes: BaseNode<TState, TOutput>[],
    options: GraphOptions = {},
  ) {
    this.nodes = nodes;
    this.maxIterations = options.maxIterations ?? 100;
    this.nodeMap = new Map(nodes.map((n) => [n.id, n]));
  }

  /**
   * Run the graph to completion, returning the final output.
   *
   * If `options.persistence` and `options.graphId` are provided and saved
   * state exists, execution resumes from the last persisted node/state.
   */
  async run(
    initialState: TState,
    startNodeId: NodeId,
    options: GraphRunOptions<TState> = {},
  ): Promise<TOutput> {
    const { persistence, graphId } = options;

    let resolvedNodeId = startNodeId;
    let resolvedState = initialState;

    // Resume from persistence if available
    if (persistence && graphId) {
      const snapshot = await persistence.load(graphId);
      if (snapshot !== null) {
        resolvedNodeId = snapshot.nodeId;
        resolvedState = snapshot.state;
      }
    }

    const run = this.runIter(resolvedState, resolvedNodeId, {
      persistence,
      graphId,
    });

    let step = await run.next();
    while (step !== null && step.kind === "node") {
      step = await run.next();
    }

    if (step === null || step.kind !== "output") {
      throw new Error("Graph ended without producing output.");
    }

    return step.output;
  }

  /**
   * Return a `GraphRun` for step-by-step execution.
   * Each call to `run.next()` executes one node.
   */
  runIter(
    initialState: TState,
    startNodeId: NodeId,
    options: GraphRunOptions<TState> = {},
  ): GraphRun<TState, TOutput> {
    return new GraphRun<TState, TOutput>(
      this.nodeMap,
      this.maxIterations,
      new Map<NodeId, number>(),
      startNodeId,
      initialState,
      options.persistence,
      options.graphId,
    );
  }

  /**
   * Generate a Mermaid flowchart diagram of this graph.
   * Edges are only included if nodes declare `nextNodes`.
   */
  toMermaid(): string {
    return toMermaid(this.nodes);
  }
}
