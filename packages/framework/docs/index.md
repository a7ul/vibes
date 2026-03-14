# Vibes Framework

A TypeScript agent framework for [Deno](https://deno.land), built as a **thin wrapper around the [Vercel AI SDK](https://sdk.vercel.ai/)**.

> **Heavily inspired by [pydantic-ai](https://ai.pydantic.dev/)** — Vibes closely mirrors pydantic-ai's philosophy, API design, and flexibility for the TypeScript/Deno ecosystem. If you've used pydantic-ai, you'll feel at home immediately. The core abstractions — agents, tools, dependency injection, result validators, streaming, testing without API calls — map almost directly. Parameters use Zod instead of Pydantic; everything else is deliberately similar.

## Why Vibes?

pydantic-ai showed that the right abstraction for LLM agents is **model-agnostic, type-safe, and testable by design**. Vibes brings those principles to TypeScript, built on the Vercel AI SDK rather than reinventing model providers.

```
Your code
   ↕
@vibes/framework   ← agent loop, tools, toolsets, DI, validation, testing
   ↕
Vercel AI SDK      ← models, streaming, structured output, providers
   ↕
Any LLM provider   ← Anthropic, OpenAI, Google, Mistral, Ollama, ...
```

This layering keeps maintenance low: Vibes doesn't duplicate provider SDKs, streaming primitives, or tokenization. You get pydantic-ai's ergonomics with the full Vercel AI SDK ecosystem.

## Quick Example

```ts
import { Agent, tool } from "@vibes/framework";
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
console.log(result.output);
// "The weather in Tokyo is currently 22°C and sunny."
```

## Getting Started

- [**Installation**](./getting-started/install.md) — set up Deno, install packages, verify
- [**Your First Agent**](./getting-started/first-agent.md) — create an agent, run it, understand the result
- [**Adding Tools**](./getting-started/adding-tools.md) — give agents capabilities
- [**Structured Output**](./getting-started/structured-output.md) — typed JSON responses with Zod
- [**Testing Your Agent**](./getting-started/testing.md) — test without API calls

## Concepts

- [**How Agents Work**](./concepts/how-agents-work.md) — the agent loop, turns, message history
- [**Dependency Injection**](./concepts/dependency-injection.md) — the `TDeps` pattern (mirrors pydantic-ai's `deps`)
- [**Error Handling**](./concepts/error-handling.md) — all error types and recovery patterns

## Guides

- [**Human-in-the-Loop**](./guides/human-in-the-loop.md) — deferred tool approval with `agent.resume()`
- [**Multi-Agent Systems**](./guides/multi-agent-systems.md) — agent-as-tool, delegation, supervisor patterns

## Reference

### Core

- [**Agents**](./agents.md) — `Agent`, `AgentOptions`, `.run()`, `.stream()`, `.resume()`
- [**Tools**](./tools.md) — `tool()`, `plainTool()`, `outputTool()`, `fromSchema()`
- [**Toolsets**](./toolsets.md) — composable, context-aware tool groups
- [**Structured Output**](./structured-output.md) — Zod-validated typed responses
- [**Result Validators**](./result-validators.md) — post-processing and retry
- [**Streaming**](./streaming.md) — `textStream`, `partialOutput`, `runStreamEvents()`
- [**Dependencies**](./dependencies.md) — injecting runtime context
- [**RunContext**](./run-context.md) — the context object available during a run
- [**Errors**](./errors.md) — all error types
- [**Testing**](./testing.md) — `TestModel`, `FunctionModel`, `setAllowModelRequests()`

### Advanced

- [**Message History**](./message-history.md) — multi-turn, history processors, serialization
- [**Usage Limits**](./usage-limits.md) — token and request budgets
- [**Deferred Tools**](./deferred-tools.md) — human approval flows
- [**Multi-Modal**](./multi-modal.md) — images, audio, file inputs
- [**Multi-Agent**](./multi-agent.md) — agent composition patterns
- [**Model Settings**](./model-settings.md) — temperature, max tokens, per-run overrides

### Integrations

- [**Graph**](./graph.md) — FSM workflows with `BaseNode` and persistence
- [**MCP**](./mcp.md) — Model Context Protocol tool servers
- [**AG-UI**](./ag-ui.md) — SSE adapter for AG-UI protocol
- [**OpenTelemetry**](./otel.md) — tracing with `instrumentAgent()`
- [**Temporal**](./temporal.md) — durable workflows

### Reference

- [**Feature Parity**](./features.md) — pydantic-ai feature comparison

## Relationship to pydantic-ai

Vibes is built on pydantic-ai's ideas. The table below shows how concepts map:

| Concept | pydantic-ai | @vibes/framework |
|---------|------------|-----------------|
| Core class | `Agent` | `Agent` |
| Run (blocking) | `agent.run_sync()` | `agent.run()` |
| Streaming | `agent.run_stream()` | `agent.stream()` |
| Tools | `@agent.tool` decorator | `tool()` factory |
| Dependencies | `deps: TDeps` | `deps: TDeps` |
| Typed output | `result_type: MyModel` | `outputSchema: z.object(...)` |
| Type validation | Pydantic | Zod |
| Result validators | `@agent.result_validator` | `resultValidators: [...]` |
| Testing | `TestModel`, `FunctionModel` | `TestModel`, `FunctionModel` |
| Human approval | — | `requiresApproval`, `agent.resume()` |
| Graph FSM | — | `Graph`, `BaseNode` |
| Language | Python | TypeScript |
| Runtime | Python 3.9+ | Deno 2 |
| Model layer | pydantic-ai providers | Vercel AI SDK |

## Installation

```jsonc
// deno.json
{
  "imports": {
    "@vibes/framework": "jsr:@vibes/framework@^0.1",
    "ai": "npm:ai@^6",
    "zod": "npm:zod@^4",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@^1"
  }
}
```

```ts
import { Agent, tool } from "@vibes/framework";
```
