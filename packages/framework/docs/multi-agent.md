# Multi-Agent

Build systems where agents delegate to other agents — either as tools the model
can invoke, or via programmatic hand-off in application code.

## Agent-as-Tool Pattern

Wrap any agent in a `tool()` definition so the parent agent can call it as if it
were a regular tool. The child agent receives a sub-prompt and returns its
output.

```ts
import { Agent, tool } from "@vibes/framework";
import { z } from "zod";

// Specialist child agent
const researchAgent = new Agent({
  model,
  systemPrompt:
    "You are a research specialist. Return concise factual summaries.",
});

// Wrap it as a tool
const researchTool = tool({
  name: "research",
  description: "Delegate a research question to the research specialist agent",
  parameters: z.object({
    question: z.string().describe("The research question to answer"),
  }),
  execute: async (_ctx, { question }) => {
    const result = await researchAgent.run(question);
    return result.output;
  },
});

// Orchestrator parent agent
const orchestrator = new Agent({
  model,
  systemPrompt:
    "You are an orchestrator. Use the research tool to gather facts.",
  tools: [researchTool],
});

const result = await orchestrator.run(
  "Write a report on the history of TypeScript.",
);
console.log(result.output);
```

## Sharing Dependencies

Pass `deps` into the child agent from the parent tool's context:

```ts
type Deps = { db: Database; userId: string };

const analyserTool = tool<Deps>({
  name: "analyse",
  description: "Run the analyst agent on a dataset",
  parameters: z.object({ datasetId: z.string() }),
  execute: async (ctx, { datasetId }) => {
    const dataset = await ctx.deps.db.datasets.get(datasetId);
    const result = await analystAgent.run(
      `Analyse: ${JSON.stringify(dataset)}`,
      {
        deps: ctx.deps, // forward deps to child
      },
    );
    return result.output;
  },
});
```

## Usage Aggregation

Each child agent run produces its own `Usage`. To roll up costs for billing or
monitoring, collect usage from child runs in the parent tool and add it to the
parent's usage:

```ts
execute: async (ctx, { question }) => {
  const result = await childAgent.run(question);
  // Manually accumulate child usage into parent context
  ctx.usage.inputTokens += result.usage.inputTokens;
  ctx.usage.outputTokens += result.usage.outputTokens;
  ctx.usage.requests += result.usage.requests;
  return result.output;
},
```

## Programmatic Hand-Off

For workflows where the next agent is selected by application code (not by the
model), chain agent runs directly:

```ts
async function handleRequest(userMessage: string) {
  // Stage 1: Classify intent
  const classifier = new Agent<undefined, z.infer<typeof IntentSchema>>({
    model: fastModel,
    outputSchema: IntentSchema,
    systemPrompt: "Classify the user intent.",
  });
  const { output: intent } = await classifier.run(userMessage);

  // Stage 2: Route to specialist
  const specialist = intent.type === "technical"
    ? technicalSupportAgent
    : generalSupportAgent;

  return specialist.run(userMessage);
}
```

## Parallel Agent Execution

Run multiple agents concurrently and merge results:

```ts
const [factResult, styleResult] = await Promise.all([
  factCheckerAgent.run(draft),
  styleReviewerAgent.run(draft),
]);

const finalResult = await editorAgent.run(
  `Original draft:\n${draft}\n\nFact check:\n${factResult.output}\n\nStyle review:\n${styleResult.output}`,
);
```

## Recipes

### Chain with Message History

Pass history between chained agents to maintain conversation context:

```ts
const stage1 = await plannerAgent.run("Plan a trip to Japan.");
const stage2 = await detailAgent.run(
  "Expand each item into a day-by-day schedule.",
  {
    messageHistory: stage1.messages,
  },
);
```

### Supervisor Pattern

A supervisor agent observes tool output and decides whether to retry with a
different specialist:

```ts
const supervisorTool = tool({
  name: "delegate",
  description: "Choose a specialist and delegate the task",
  parameters: z.object({
    specialist: z.enum(["writer", "analyst", "coder"]),
    task: z.string(),
  }),
  execute: async (_ctx, { specialist, task }) => {
    const agents = {
      writer: writerAgent,
      analyst: analystAgent,
      coder: coderAgent,
    };
    const result = await agents[specialist].run(task);
    return result.output;
  },
});
```

## Error Behavior

- Child agent errors propagate as tool errors — the parent model sees the error
  message and can retry or fall back.
- `MaxTurnsError` and `UsageLimitError` from child agents are **not**
  automatically caught. Wrap child `agent.run()` calls in try/catch if you want
  to handle them gracefully.
- Usage from child agents is not automatically merged into parent usage unless
  you do so explicitly in the tool's `execute` function.
