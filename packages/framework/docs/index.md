# Vibes Framework

A TypeScript agent framework built on the
[Vercel AI SDK](https://sdk.vercel.ai/). Vibes lets you define agents with
tools, structured output, result validation, and streaming — with full type
safety through generics.

## Documentation

### Core

- [**Agents**](./agents.md) — Creating and running agents
- [**Tools**](./tools.md) — Defining tools with Zod schemas and dependency
  injection
- [**Toolsets**](./toolsets.md) — Composable, context-aware tool groups
- [**Structured Output**](./structured-output.md) — Zod-validated typed
  responses
- [**Result Validators**](./result-validators.md) — Post-processing and retrying
  output
- [**Streaming**](./streaming.md) — Consuming responses as they arrive
- [**Dependencies**](./dependencies.md) — Injecting runtime context into tools
  and prompts
- [**RunContext**](./run-context.md) — The context object available during a run
- [**Errors**](./errors.md) — Error types and how to handle them
- [**Testing**](./testing.md) — Unit testing agents without API calls

### Advanced

- [**Message History**](./message-history.md) — Multi-turn conversations,
  history processors, and serialization
- [**Usage Limits**](./usage-limits.md) — Capping tokens and requests per run
- [**Deferred Tools**](./deferred-tools.md) — Human-in-the-loop approval flows
- [**Multi-Modal**](./multi-modal.md) — Images, audio, and file inputs
- [**Multi-Agent**](./multi-agent.md) — Agent-as-tool and programmatic hand-off
- [**Model Settings**](./model-settings.md) — Temperature, max tokens, and
  per-run overrides

### Integrations

- [**Graph**](./graph.md) — Finite-state machine workflows with `BaseNode`
- [**MCP**](./mcp.md) — Model Context Protocol tool servers
- [**AG-UI**](./ag-ui.md) — Server-Sent Events adapter for AG-UI protocol
- [**OpenTelemetry**](./otel.md) — Tracing with `instrumentAgent()`
- [**Temporal**](./temporal.md) — Durable agent workflows with Temporal

### Reference

- [**Feature Parity**](./features.md) — pydantic-ai features and what's still
  missing

## Installation

```ts
// deno.json
{
  "imports": {
    "ai": "npm:ai@^4",
    "zod": "npm:zod@^3",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@^1"
  }
}
```

Import from `mod.ts`:

```ts
import { Agent, tool } from "./mod.ts";
```

## Quick Example

```ts
import { Agent, tool } from "./mod.ts";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({ city: z.string() }),
  execute: async (_ctx, { city }) => `${city}: 22°C, sunny`,
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful weather assistant.",
  tools: [weather],
});

const result = await agent.run("What's the weather in Tokyo?");
console.log(result.output); // "The weather in Tokyo is 22°C and sunny."
```
