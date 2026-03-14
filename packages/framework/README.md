# @vibes/framework

A TypeScript agent framework for [Deno](https://deno.land), built as a thin layer on top of the [Vercel AI SDK](https://sdk.vercel.ai/).

> **Heavily inspired by [pydantic-ai](https://ai.pydantic.dev/)** — Vibes closely mirrors pydantic-ai's philosophy, API design, and flexibility, but for the TypeScript/Deno ecosystem. If you've used pydantic-ai, you'll feel at home immediately. If you haven't, you'll find the same focus on type safety, composability, and testability that makes pydantic-ai the gold standard for Python agents.

## Why Vibes?

**The best of both worlds:**

- **pydantic-ai's philosophy** — type-safe dependency injection, composable toolsets, result validators, streaming, testing without API calls, and a clean mental model for how agents work
- **Vercel AI SDK's features** — every model provider (Anthropic, OpenAI, Google, Mistral, etc.), streaming primitives, structured output, and the entire ecosystem of provider packages
- **Stays thin** — Vibes adds the agent orchestration layer that AI SDK deliberately leaves out. It doesn't reinvent streaming, tokenization, or provider adapters. This keeps maintenance low and lets you benefit from AI SDK improvements automatically.

```
Your code
   ↕
@vibes/framework   ← agent loop, tools, toolsets, DI, validation, testing
   ↕
Vercel AI SDK      ← models, streaming, structured output, providers
   ↕
Any LLM provider   ← Anthropic, OpenAI, Google, Mistral, Ollama, ...
```

## Quick Start

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

## Installation

Add to your `deno.json`:

```jsonc
{
  "imports": {
    "@vibes/framework": "jsr:@vibes/framework@^0.1",
    "ai": "npm:ai@^6",
    "zod": "npm:zod@^4",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@^1"
  }
}
```

## Feature Highlights

| Feature | Description |
|---------|-------------|
| **Multi-provider** | Works with any Vercel AI SDK model — Anthropic, OpenAI, Google, Ollama, and more |
| **Toolsets** | Composable, context-aware tool groups — filter, prefix, wrap, combine |
| **Structured output** | Zod-validated typed responses via a `final_result` tool |
| **Dependency injection** | Type-safe `deps` pattern flows through tools, prompts, and validators |
| **Streaming** | `.stream()`, `textStream`, `partialOutput`, `runStreamEvents()` |
| **History processors** | Transform message history per-turn — trim, token-limit, summarize |
| **Deferred tools** | Human-in-the-loop approval flows with `agent.resume()` |
| **MCP servers** | Connect to Model Context Protocol tool servers (stdio + HTTP) |
| **Graph workflows** | FSM-style multi-step pipelines with persistence and Mermaid diagrams |
| **Temporal** | Durable agent workflows via Temporal.io |
| **AG-UI** | Server-sent events adapter for AG-UI-compatible frontends |
| **OpenTelemetry** | First-class tracing with `instrumentAgent()` |
| **Testing** | `TestModel`, `FunctionModel`, `setAllowModelRequests(false)` — no real API calls needed |

## Documentation

### Getting Started
- [**Installation**](./docs/getting-started/install.md)
- [**Your First Agent**](./docs/getting-started/first-agent.md)
- [**Adding Tools**](./docs/getting-started/adding-tools.md)
- [**Structured Output**](./docs/getting-started/structured-output.md)
- [**Testing Your Agent**](./docs/getting-started/testing.md)

### Concepts
- [**How Agents Work**](./docs/concepts/how-agents-work.md) — the agent loop, turns, and message history
- [**Dependency Injection**](./docs/concepts/dependency-injection.md) — the `TDeps` pattern
- [**Error Handling**](./docs/concepts/error-handling.md) — all error types and recovery patterns

### Guides
- [**Multi-Turn Conversations**](./docs/guides/multi-turn-conversations.md)
- [**Streaming Responses**](./docs/guides/streaming-responses.md)
- [**Human-in-the-Loop**](./docs/guides/human-in-the-loop.md) — deferred tool approval
- [**Multi-Agent Systems**](./docs/guides/multi-agent-systems.md)
- [**MCP Servers**](./docs/guides/mcp-servers.md)

### Reference
- [Agents](./docs/agents.md) · [Tools](./docs/tools.md) · [Toolsets](./docs/toolsets.md)
- [Structured Output](./docs/structured-output.md) · [Streaming](./docs/streaming.md)
- [Dependencies](./docs/dependencies.md) · [Testing](./docs/testing.md)
- [Message History](./docs/message-history.md) · [Deferred Tools](./docs/deferred-tools.md)
- [Graph](./docs/graph.md) · [MCP](./docs/mcp.md) · [AG-UI](./docs/ag-ui.md)
- [OpenTelemetry](./docs/otel.md) · [Temporal](./docs/temporal.md)
- [Full reference index](./docs/index.md)

## Relationship to pydantic-ai

Vibes is deliberately modeled on [pydantic-ai](https://ai.pydantic.dev/). The core abstractions — agents, tools, dependency injection, result validators, streaming, and testing utilities — map almost directly. The key differences:

| | pydantic-ai | @vibes/framework |
|--|------------|-----------------|
| Language | Python | TypeScript |
| Runtime | Python 3.9+ | Deno |
| Model layer | pydantic-ai's own providers | Vercel AI SDK |
| Type validation | Pydantic | Zod |
| Async | asyncio | native async/await |
| Streaming | async generators | AI SDK streams |

If you're porting a pydantic-ai agent to TypeScript, most concepts transfer directly. See [Feature Parity](./docs/features.md) for the current status.

## License

MIT
