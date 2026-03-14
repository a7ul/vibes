# Graph

A `Graph` is a finite-state machine (FSM) where each node can run an agent, call
an API, or do any async work, then transition to another node or emit a final
output.

## What is a Graph?

Use a Graph when your workflow has discrete states with conditional transitions:
multi-step pipelines, retry loops, human-in-the-loop branching, or any process
that is too complex for a single agent turn. Unlike a plain agent loop, a Graph
makes transitions explicit and inspectable.

## `BaseNode`

Extend `BaseNode` to define a node. Implement `id` and `run()`:

```ts
import { BaseNode } from "./mod.ts";

type State = { query: string; results?: string[] };

class FetchNode extends BaseNode<State, string> {
  readonly id = "fetch";
  readonly nextNodes = ["summarise"]; // optional — for Mermaid diagrams

  async run(state: State) {
    const results = await searchWeb(state.query);
    return this.next("summarise", { ...state, results });
  }
}

class SummariseNode extends BaseNode<State, string> {
  readonly id = "summarise";

  async run(state: State) {
    const summary = await agent.run(`Summarise: ${state.results?.join("\n")}`);
    return this.output(summary.output);
  }
}
```

`run()` must return one of:

- `this.next(nodeId, newState)` — transition to another node with updated state
- `this.output(value)` — end the graph and emit `value` as the final output

## `Graph`

Construct a `Graph` with your nodes and run it:

```ts
import { Graph } from "./mod.ts";

const graph = new Graph({
  nodes: [new FetchNode(), new SummariseNode()],
});

const output = await graph.run(
  { query: "TypeScript history" }, // initial state
  "fetch", // starting node ID
);

console.log(output); // final string from SummariseNode
```

### `GraphOptions`

| Option          | Type     | Default | Description                                      |
| --------------- | -------- | ------- | ------------------------------------------------ |
| `maxIterations` | `number` | `100`   | Max node visits before `MaxGraphIterationsError` |

## Step-by-Step Execution with `GraphRun`

`graph.runIter()` returns a `GraphRun` handle that lets you step through the
graph one node at a time. Useful for observing intermediate state or building
human-in-the-loop workflows:

```ts
const run = graph.runIter({ query: "TypeScript" }, "fetch");

let step = await run.next();
while (step !== null && step.kind === "node") {
  console.log("At node:", step.nodeId);
  console.log("State:", step.state);
  step = await run.next();
}

if (step?.kind === "output") {
  console.log("Final output:", step.output);
}
```

### `GraphStep` union

| `kind`     | Fields                            | Description                        |
| ---------- | --------------------------------- | ---------------------------------- |
| `"node"`   | `nodeId: string`, `state: TState` | Paused at a node after it ran      |
| `"output"` | `output: TOutput`                 | Graph completed with a final value |

## State Persistence

Provide a `StatePersistence` implementation to make graph runs resumable across
process restarts or failures:

```ts
import type { StatePersistence } from "./mod.ts";

class KVPersistence<TState> implements StatePersistence<TState> {
  constructor(private kv: Deno.Kv) {}

  async save(graphId: string, nodeId: string, state: TState) {
    await this.kv.set(["graph", graphId], { nodeId, state });
  }

  async load(graphId: string) {
    const entry = await this.kv.get<{ nodeId: string; state: TState }>([
      "graph",
      graphId,
    ]);
    return entry.value ?? null;
  }
}

const output = await graph.run(initialState, "start", {
  persistence: new KVPersistence(kv),
  graphId: "my-workflow-123",
});
```

On the first run, execution starts from the given node. If the process crashes,
calling `graph.run()` again with the same `graphId` resumes from the last saved
node.

## Mermaid Visualization

Generate a Mermaid diagram of your graph structure for documentation or
debugging. Edges are derived from `nextNodes` declared on each node:

```ts
const diagram = graph.toMermaid();
console.log(diagram);
// stateDiagram-v2
//   [*] --> fetch
//   fetch --> summarise
//   summarise --> [*]
```

## Recipes

### Retry Loop

Return to the same node on failure:

```ts
class ValidateNode extends BaseNode<State, Report> {
  readonly id = "validate";
  readonly nextNodes = ["generate", "validate"];

  async run(state: State) {
    const { output } = await validatorAgent.run(state.draft);
    if (output.valid) {
      return this.output({ draft: state.draft, score: output.score });
    }
    return this.next("generate", { ...state, feedback: output.feedback });
  }
}
```

### Branching on State

```ts
class RouterNode extends BaseNode<State, never> {
  readonly id = "router";
  readonly nextNodes = ["fast-path", "slow-path"];

  async run(state: State) {
    return state.complexity === "low"
      ? this.next("fast-path", state)
      : this.next("slow-path", state);
  }
}
```

## API Reference

### `BaseNode<TState, TOutput>`

| Member                 | Type                             | Description                             |
| ---------------------- | -------------------------------- | --------------------------------------- |
| `id`                   | `string` (abstract)              | Unique node identifier                  |
| `nextNodes`            | `string[]` (optional)            | Declared transition targets for Mermaid |
| `run(state)`           | `Promise<NodeResult>` (abstract) | Node logic                              |
| `this.next(id, state)` | `NodeResult`                     | Transition helper                       |
| `this.output(value)`   | `NodeResult`                     | End-graph helper                        |

### `Graph<TState, TOutput>`

| Member      | Signature                                       | Description              |
| ----------- | ----------------------------------------------- | ------------------------ |
| constructor | `({ nodes, maxIterations? })`                   | Build the graph          |
| `run`       | `(state, startNode, opts?) => Promise<TOutput>` | Execute fully            |
| `runIter`   | `(state, startNode, opts?) => GraphRun`         | Step-by-step handle      |
| `toMermaid` | `() => string`                                  | Generate Mermaid diagram |

## Error Behavior

- `MaxGraphIterationsError` — thrown when a single node is visited more than
  `maxIterations` times. Indicates an infinite loop in your transition logic.
- `UnknownNodeError` — thrown when `this.next()` references a node ID not
  registered in the graph.
- Node errors propagate out of `graph.run()` / `GraphRun.next()` unchanged. Use
  try/catch around node logic to implement error-handling transitions.
