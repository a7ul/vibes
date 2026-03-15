<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/logo/dark.svg">
    <img alt="@vibesjs/sdk" src="./docs/logo/light.svg" width="280">
  </picture>
</p>

# @vibesjs/sdk

[![JSR](https://jsr.io/badges/@vibesjs/sdk)](https://jsr.io/@vibesjs/sdk)
[![npm](https://img.shields.io/npm/v/@vibesjs/sdk)](https://www.npmjs.com/package/@vibesjs/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**TypeScript agent framework for building production-grade, type-safe AI applications and workflows, the Pydantic AI way, powered by Vercel AI SDK.**

> Heavily inspired by [Pydantic AI](https://ai.pydantic.dev/). Vibes mirrors its philosophy, API design, and flexibility for the TypeScript ecosystem. If you've used Pydantic AI, you'll feel at home immediately.

```
Your code
   ↕
@vibesjs/sdk   ← agent loop, tools, toolsets, DI, evals, graph, testing
   ↕
Vercel AI SDK      ← models, streaming, structured output, providers
   ↕
Any LLM provider   ← Anthropic, OpenAI, Google, Groq, Mistral, Ollama, ...
```

## Installation

**Deno** — add to `deno.json`:

```jsonc
{
  "imports": {
    "@vibesjs/sdk": "jsr:@vibesjs/sdk@^1.0",
    "ai": "npm:ai@^6",
    "zod": "npm:zod@^4",
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@^1"
  }
}
```

Or use the CLI:

```bash
deno add jsr:@vibesjs/sdk
deno add npm:@ai-sdk/anthropic
```

**Node.js** (18+, TypeScript 5+):

```bash
npx jsr add @vibesjs/sdk
npm install ai zod @ai-sdk/anthropic
```

Add to `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Quick Start

```ts
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run("What is the capital of France?");
console.log(result.output); // "Paris"
```

## Why Vibes?

1. **Type-safe tools + Dependency injection** — Every tool parameter is validated at runtime with Zod. Carry databases, HTTP clients, and config via `RunContext` through the entire call chain. No `any` types, no global state.
2. **Model-agnostic** — Switch between Anthropic, OpenAI, Google, Groq, Mistral, Ollama, and 50+ providers by changing one line.
3. **Structured output + Streaming** — Define a Zod schema, get back a typed object or stream typed partial objects to the client as they arrive.
4. **Automatic retries + Cost control** — Retries on validation failure and enforces token budgets and request limits to keep costs in check.
5. **First-class testing — no API calls required** — `TestModel`, `FunctionModel`, `agent.override()`, and `setAllowModelRequests(false)` make every agent fully testable in CI without hitting a real LLM.
6. **Robust evaluations** — Define typed datasets, score outputs with built-in or LLM-as-judge evaluators, and run experiments with configurable concurrency and retries. Evals are code — they live in your repo and run in CI.
7. **MCP, AG-UI, A2A + Durable agents via Temporal** — Connect to MCP servers, build AG-UI and A2A agents out of the box. Run long-lived agents that survive crashes and restarts with Temporal.
8. **OpenTelemetry observability** — Every run emits OTel spans, events, and token usage metrics. Works with Jaeger, Honeycomb, Datadog, and any OTel-compatible backend.

## Progressive Examples

### 1 — Bare agent (6 lines)

```ts
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful weather assistant.",
});

const result = await agent.run("What's the weather like today?");
console.log(result.output);
```

### 2 — Tools + structured output

```ts
import { Agent, tool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({ city: z.string().describe("City name") }),
  execute: async (_ctx, { city }) => `${city}: 22°C, sunny`,
});

const WeatherReport = z.object({
  city: z.string(),
  temperature: z.number().describe("Temperature in Celsius"),
  condition: z.string(),
  summary: z.string(),
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful weather assistant.",
  tools: [getWeather],
  outputSchema: WeatherReport,
});

const result = await agent.run("What's the weather in Tokyo?");
// result.output is typed as { city: string; temperature: number; condition: string; summary: string }
console.log(result.output.city);        // "Tokyo"
console.log(result.output.temperature); // 22
```

### 3 — Dependency injection

```ts
import { Agent, tool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// Declare the deps your agent needs
type Deps = { weatherApi: { fetch: (city: string) => Promise<string> } };

const getWeather = tool({
  name: "get_weather",
  description: "Get weather from the injected API",
  parameters: z.object({ city: z.string() }),
  // ctx.deps is fully typed as Deps
  execute: async (ctx, { city }) => ctx.deps.weatherApi.fetch(city),
});

const agent = new Agent<Deps>({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a weather assistant.",
  tools: [getWeather],
});

// Inject real dependencies at run time
const result = await agent.run("Weather in Paris?", {
  deps: { weatherApi: { fetch: async (city) => `${city}: 18°C, cloudy` } },
});
```

### 4 — Testing without API calls

```ts
import { Agent, tool, TestModel, setAllowModelRequests } from "@vibesjs/sdk";
import { z } from "zod";

setAllowModelRequests(false); // block accidental real API calls in CI

const agent = new Agent({
  model: /* real model here — overridden below */,
  systemPrompt: "You are a weather assistant.",
  tools: [getWeather],
  outputSchema: WeatherReport,
});

Deno.test("weather agent returns structured output", async () => {
  const result = await agent
    .override({ model: new TestModel() })
    .run("Weather in Tokyo?");

  // TestModel auto-calls tools and produces schema-valid output
  assertEquals(typeof result.output.city, "string");
  assertEquals(typeof result.output.temperature, "number");
});
```

## Feature Highlights

| Feature | Description |
|---------|-------------|
| **Multi-provider** | Any Vercel AI SDK model — Anthropic, OpenAI, Google, Groq, Mistral, Ollama, and 50+ more |
| **Tools** | Type-safe tool definitions with Zod parameter validation |
| **Toolsets** | Composable, context-aware tool groups — filter, prefix, wrap, combine |
| **Structured output** | Zod-validated typed responses via a `final_result` tool |
| **Dependency injection** | Type-safe `RunContext<TDeps>` flows through tools, prompts, and validators |
| **Streaming** | `.stream()`, `textStream`, `partialOutput`, `runStreamEvents()` |
| **Evaluations** | Typed datasets, built-in evaluators, LLM-as-judge, experiment runners — runs in CI |
| **Multimodal** | Send images, audio, and files via `imageMessage()`, `audioMessage()`, `fileMessage()` |
| **Extended thinking** | Pass `thinking` settings through to models that support it |
| **History processors** | Transform message history per-turn — trim, token-limit, summarize, privacy-filter |
| **Deferred tools** | Human-in-the-loop approval flows with `agent.resume()` |
| **MCP client** | Connect to Model Context Protocol tool servers (stdio + HTTP) |
| **MCP server** | Expose your agent as an MCP server |
| **A2A protocol** | Agent-to-Agent protocol adapter for interop with other A2A agents |
| **AG-UI** | Server-sent events adapter for AG-UI-compatible frontends |
| **Graph workflows** | FSM-style multi-step pipelines with persistence and Mermaid diagrams |
| **Temporal** | Durable agent workflows via Temporal.io — survives crashes and restarts |
| **OpenTelemetry** | First-class tracing with `instrumentAgent()` |
| **Testing** | `TestModel`, `FunctionModel`, `setAllowModelRequests(false)` — no real API calls needed |

## Agent Skill

Install the `@vibesjs/sdk` agent skill so your coding assistant has full API knowledge built-in:

```bash
# Project-level (recommended)
mkdir -p .claude/agents && curl -fsSL https://raw.githubusercontent.com/a7ul/vibes/main/packages/sdk/skills/vibes-sdk.md -o .claude/agents/vibes-sdk.md
```

```bash
# Global (available in all projects)
mkdir -p ~/.claude/agents && curl -fsSL https://raw.githubusercontent.com/a7ul/vibes/main/packages/sdk/skills/vibes-sdk.md -o ~/.claude/agents/vibes-sdk.md
```

See [skills/README.md](./skills/README.md) for more options.

## Documentation

### Getting Started
- [**Installation**](./docs/getting-started/install.mdx)
- [**Hello World**](./docs/getting-started/hello-world.mdx)

### Concepts
- [**Agents**](./docs/concepts/agents.mdx) — agent loop, system prompts, run context
- [**Tools**](./docs/concepts/tools.mdx) — type-safe tools with Zod
- [**Toolsets**](./docs/concepts/toolsets.mdx) — composable tool groups
- [**Dependencies**](./docs/concepts/dependencies.mdx) — the `RunContext<TDeps>` pattern
- [**Results**](./docs/concepts/results.mdx) — structured output and validators
- [**Streaming**](./docs/concepts/streaming.mdx) — text streams and partial output
- [**Testing**](./docs/concepts/testing.mdx) — TestModel, FunctionModel, no API calls
- [**Evaluations**](./docs/concepts/evals.mdx) — datasets, evaluators, LLM-as-judge
- [**Messages**](./docs/concepts/messages.mdx) — message history and serialization
- [**Human-in-the-Loop**](./docs/concepts/human-in-the-loop.mdx) — deferred tool approval
- [**Multi-Agent**](./docs/concepts/multi-agent.mdx) — agent composition patterns
- [**Graph**](./docs/concepts/graph.mdx) — FSM-style multi-step workflows
- [**Models**](./docs/concepts/models.mdx) — model configuration and providers
- [**Thinking**](./docs/concepts/thinking.mdx) — extended thinking support
- [**Debugging**](./docs/concepts/debugging.mdx) — logging and introspection

### Integrations
- [**MCP Client**](./docs/integrations/mcp-client.mdx) — connect to MCP tool servers
- [**MCP Server**](./docs/integrations/mcp-server.mdx) — expose your agent as an MCP server
- [**A2A**](./docs/integrations/a2a.mdx) — Agent-to-Agent protocol adapter
- [**AG-UI**](./docs/integrations/ag-ui.mdx) — AG-UI SSE adapter
- [**Vercel AI UI**](./docs/integrations/vercel-ai-ui.mdx) — `useChat` / `useCompletion` integration
- [**Temporal**](./docs/integrations/temporal.mdx) — durable execution via Temporal.io

### Advanced
- [**Multimodal**](./docs/advanced/multimodal.mdx) — images, audio, and file inputs
- [**Error Handling**](./docs/advanced/error-handling.mdx) — all error types and recovery
- [**Direct Model Requests**](./docs/advanced/direct-model-requests.mdx)

### Reference
- [**Feature Parity**](./docs/reference/features.mdx) — Pydantic AI feature status

## Relationship to Pydantic AI

Vibes is deliberately modeled on [Pydantic AI](https://ai.pydantic.dev/). The core abstractions — agents, tools, dependency injection, result validators, streaming, and testing utilities — map almost directly. The key differences:

| | Pydantic AI | @vibesjs/sdk |
|--|------------|-----------------|
| Language | Python | TypeScript |
| Runtime | Python 3.9+ | Deno / Node.js 18+ |
| Model layer | Pydantic AI's own providers | Vercel AI SDK |
| Type validation | Pydantic | Zod |
| Async | asyncio | native async/await |
| Streaming | async generators | AI SDK streams |

If you're porting a Pydantic AI agent to TypeScript, most concepts transfer directly.

## Contributing

Contributions are welcome! Please read the [contributing guide](./docs/reference/contributing.mdx) before submitting a PR.

- **Bug reports**: Open an issue with a minimal reproduction
- **Feature requests**: Open a discussion before coding
- **PRs**: Run `deno test -A` and ensure all tests pass

## License

MIT
