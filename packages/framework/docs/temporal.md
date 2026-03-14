# Temporal

Run agents as durable Temporal workflows — surviving process crashes, network
failures, and arbitrary pauses — with full activity replay.

## What is Temporal?

[Temporal](https://temporal.io/) is a durable execution platform. Workflows are
recorded as event histories; if a worker crashes, Temporal replays the history
on restart so execution continues from where it left off. This makes
long-running, multi-step agent workflows resilient by default.

## `TemporalAgent`

`TemporalAgent` wraps a standard `Agent` and registers its execution as a
Temporal workflow + activity:

```ts
import { TemporalAgent } from "@vibes/framework";
import { Agent } from "@vibes/framework";
import { Client, Connection } from "@temporalio/client";

const agent = new Agent({
  model,
  systemPrompt: "You are a research assistant.",
  tools: [searchTool, summariseTool],
});

const temporalAgent = new TemporalAgent(agent, {
  taskQueue: "research-queue",
});

// Start a durable run
const connection = await Connection.connect();
const client = new Client({ connection });

const handle = await temporalAgent.start(client, {
  workflowId: "research-001",
  args: { prompt: "Summarise recent AI papers." },
});

const result = await handle.result();
console.log(result.output);
```

## `MockTemporalAgent`

For local development and testing, `MockTemporalAgent` runs the same workflow
logic in-process without requiring a Temporal server:

```ts
import { MockTemporalAgent } from "@vibes/framework";

const mockAgent = new MockTemporalAgent(agent);

const result = await mockAgent.run({
  prompt: "What is the capital of France?",
});

console.log(result.output); // "Paris"
```

`MockTemporalAgent` is a drop-in replacement for `TemporalAgent` in tests — same
API, no Temporal infrastructure required.

## Worker Setup

Register your `TemporalAgent` as a worker to handle incoming workflow tasks:

```ts
import { Worker } from "@temporalio/worker";

const worker = await Worker.create({
  taskQueue: "research-queue",
  workflowsPath: temporalAgent.workflowsPath(),
  activities: temporalAgent.activities(),
});

await worker.run();
```

## State Serialization

Temporal requires all workflow state to be serializable to JSON. The framework
provides helpers for safe serialization of agent messages and results:

```ts
import { deserializeAgentState, serializeAgentState } from "@vibes/framework";

// Inside a workflow activity — safe to use in Temporal context
const serialized = serializeAgentState(result);
```

## Node.js Constraint

Temporal's Node.js SDK requires the **Node.js runtime**. The `TemporalAgent` and
its worker components cannot run under Deno. Use Node.js (v18+) for Temporal
workers.

`MockTemporalAgent` has no runtime constraint and works under Deno — use it for
all tests and local development.

```ts
// In Deno tests — use MockTemporalAgent
import { MockTemporalAgent } from "@vibes/framework";
const mock = new MockTemporalAgent(agent);

// In Node.js workers — use TemporalAgent
import { TemporalAgent } from "@vibes/framework";
const temporal = new TemporalAgent(agent, { taskQueue: "..." });
```

## Recipes

### Long-Running Research Workflow

```ts
const temporalAgent = new TemporalAgent(researchAgent, {
  taskQueue: "research",
  workflowExecutionTimeout: "24h", // survive overnight
  activityStartToCloseTimeout: "10m", // per-turn timeout
});

const handle = await temporalAgent.start(client, {
  workflowId: `research-${Date.now()}`,
  args: { prompt: "Compile a literature review on quantum computing." },
});

// Poll for result later
const result = await handle.result();
```

### Human-in-the-Loop with Temporal Signals

Combine Temporal signals with deferred tools for durable approval workflows:

```ts
// The workflow pauses when ApprovalRequiredError is thrown
// and waits for a Temporal signal before resuming
const temporalAgent = new TemporalAgent(agentWithApprovalTools, {
  taskQueue: "approvals",
  signalOnApproval: "human-approved",
});
```

## API Reference

### `TemporalAgent`

| Member          | Signature                                      | Description                                      |
| --------------- | ---------------------------------------------- | ------------------------------------------------ |
| constructor     | `(agent, options)`                             | Wrap an agent for Temporal                       |
| `start`         | `(client, options) => Promise<WorkflowHandle>` | Start a durable workflow                         |
| `workflowsPath` | `() => string`                                 | Path to workflow definitions for `Worker.create` |
| `activities`    | `() => Activities`                             | Activity implementations for `Worker.create`     |

### `TemporalAgent` Options

| Option                        | Type     | Default  | Description                     |
| ----------------------------- | -------- | -------- | ------------------------------- |
| `taskQueue`                   | `string` | required | Temporal task queue name        |
| `workflowExecutionTimeout`    | `string` | —        | Max total workflow duration     |
| `activityStartToCloseTimeout` | `string` | `"5m"`   | Timeout per agent turn activity |

### `MockTemporalAgent`

| Member      | Signature                      | Description                                 |
| ----------- | ------------------------------ | ------------------------------------------- |
| constructor | `(agent)`                      | Wrap an agent for in-process mock execution |
| `run`       | `(args) => Promise<RunResult>` | Execute without Temporal infrastructure     |

## Error Behavior

- Temporal activities are retried automatically on failure. Transient model API
  errors (rate limits, timeouts) are retried by Temporal's retry policy before
  reaching the `maxRetries` framework limit.
- `MaxTurnsError` and `UsageLimitError` are non-retryable — they cause the
  workflow to fail immediately.
- When using `MockTemporalAgent`, errors propagate synchronously from `run()`.
