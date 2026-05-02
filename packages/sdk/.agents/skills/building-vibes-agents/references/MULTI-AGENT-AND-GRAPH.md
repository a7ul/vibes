# Multi-Agent and Graph

Read this file when the user wants to build multi-agent systems, use agent-as-tool patterns, build graph-based workflows, or coordinate agents sequentially.

## Agent-as-Tool Pattern

Call a sub-agent from inside a tool. The parent agent's model decides when to invoke the sub-agent.

```typescript
import { Agent, tool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// Sub-agent: specialized for research
const researchAgent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a research assistant. Be thorough and cite sources.",
  tools: [webSearchTool, fetchPageTool],
});

// Tool that wraps the sub-agent
const researchTool = tool({
  name: "research",
  description: "Research a topic thoroughly and return a summary.",
  parameters: z.object({ topic: z.string() }),
  execute: async (ctx, { topic }) => {
    const result = await researchAgent.run(topic, {
      // Share usage tracking with the parent
      usage: ctx.usage,
    });
    return result.output;
  },
});

// Parent orchestrator agent
const orchestrator = new Agent({
  model: anthropic("claude-opus-4-6"),
  systemPrompt: "You are an orchestrator. Delegate research to the research tool.",
  tools: [researchTool, writeTool],
});

const result = await orchestrator.run("Write a report on quantum computing.");
```

## Sequential Multi-Agent Handoff

App code dispatches agents in sequence — each agent's output becomes the next agent's input:

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const plannerAgent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "Break the user's request into a step-by-step plan.",
});

const executorAgent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "Execute each step of the provided plan.",
  tools: [searchTool, writeTool, emailTool],
});

const reviewerAgent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  systemPrompt: "Review the output and identify any issues.",
});

async function runPipeline(request: string) {
  const plan = await plannerAgent.run(request);
  const execution = await executorAgent.run(plan.output);
  const review = await reviewerAgent.run(execution.output);
  return { plan: plan.output, result: execution.output, review: review.output };
}
```

## Graph Workflows

Use `Graph` when the workflow has explicit states, conditional branching, or needs pause/resume capability.

```typescript
import { Agent, Graph, BaseNode, next, output } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// (1) Define state
interface WorkflowState {
  query: string;
  searchResults?: string;
  finalAnswer?: string;
}

// (2) Define nodes
class SearchNode extends BaseNode<WorkflowState> {
  static nodeId = "search";

  async run(state: WorkflowState) {
    const results = await doSearch(state.query);
    return next(new AnalyzeNode(), { ...state, searchResults: results });
  }
}

class AnalyzeNode extends BaseNode<WorkflowState> {
  static nodeId = "analyze";

  async run(state: WorkflowState) {
    const agent = new Agent({
      model: anthropic("claude-sonnet-4-6"),
      systemPrompt: "Analyze the search results and provide an answer.",
    });
    const result = await agent.run(
      `Query: ${state.query}\n\nResults: ${state.searchResults}`,
    );
    return output({ ...state, finalAnswer: result.output });
  }
}

// (3) Build and run the graph
const graph = new Graph([SearchNode, AnalyzeNode]);
const run = graph.run({ query: "What is quantum computing?" }, new SearchNode());

for await (const event of run) {
  if (event.type === "output") {
    console.log(event.state.finalAnswer);
  }
}
```

Key points:
- `next(NodeClass, newState)` — transition to another node
- `output(finalState)` — end the graph run with a final state
- `next()` and `output()` are free functions imported from `@vibesjs/sdk`, NOT methods on the node

## Graph State Persistence

Use `FileStatePersistence` or `MemoryStatePersistence` to pause and resume graph runs across restarts:

```typescript
import { Graph, FileStatePersistence, BaseNode, next, output } from "@vibesjs/sdk";

const persistence = new FileStatePersistence("./workflow-state.json");

const graph = new Graph([StepANode, StepBNode, StepCNode], { persistence });

// Start (or resume) the run
const runId = "my-workflow-123";
const run = graph.run(initialState, new StepANode(), { runId });

for await (const event of run) {
  // If the process is killed and restarted, the run resumes from the last checkpoint
}
```

## Graph Visualization

Generate a Mermaid diagram of the graph:

```typescript
import { toMermaid } from "@vibesjs/sdk";

const diagram = toMermaid(graph, [SearchNode, AnalyzeNode]);
console.log(diagram);
// flowchart TD
//   search["SearchNode"] --> analyze["AnalyzeNode"]
```

## Graph Manual Stepping

Use `graph.runIter()` for step-by-step control:

```typescript
import { Graph } from "@vibesjs/sdk";

const graphRun = graph.runIter(initialState, new StartNode());

while (true) {
  const { value, done } = await graphRun.next();
  if (done) break;
  console.log("Current node:", value.nodeId);
}
```

## Usage Aggregation in Multi-Agent Systems

When calling sub-agents, pass the parent's `ctx.usage` to merge token costs:

```typescript
const subAgentTool = tool({
  name: "call_sub_agent",
  description: "Delegate to the sub-agent.",
  parameters: z.object({ task: z.string() }),
  execute: async (ctx, { task }) => {
    const result = await subAgent.run(task, {
      usage: ctx.usage, // merges sub-agent costs into parent's usage
    });
    return result.output;
  },
});
```

After the parent run, `result.usage` includes both the parent's and all sub-agents' token usage.
