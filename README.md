<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./logo/vibes-lockup-dark.svg">
    <img alt="vibes" src="./logo/vibes-lockup-light.svg" width="280">
  </picture>
</p>

# vibes

[![JSR](https://jsr.io/badges/@vibesjs/sdk)](https://jsr.io/@vibesjs/sdk)
[![npm](https://img.shields.io/npm/v/@vibesjs/sdk)](https://www.npmjs.com/package/@vibesjs/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./packages/sdk/LICENSE)

**TypeScript agent framework for building production-grade, type-safe AI applications and workflows, the Pydantic AI way, using Vercel AI SDK.**

```
Your code
   ↕
@vibesjs/sdk   ← agent loop, tools, toolsets, DI, evals, graph, testing
   ↕
Vercel AI SDK      ← models, streaming, structured output, providers
   ↕
Any LLM provider   ← Anthropic, OpenAI, Google, Groq, Mistral, Ollama, ...
```

## Philosophy

Most AI frameworks try to hide the model behind magic. Vibes does the opposite — it gives you a thin, typed layer that stays out of the way.

The core idea is borrowed from Pydantic AI: **agents are just functions**. They take input, call tools, and return typed output. There's no hidden state, no opaque orchestration engine, no DSL to learn. If you know TypeScript and async/await, you already know how to use Vibes.

Everything flows through `RunContext`. Your database, your HTTP clients, your config — injected once, available everywhere. Tools are plain functions with a Zod schema attached. Structured output is just a Zod schema on the agent. Testing is `TestModel` — no API calls, no mocking hell, runs in CI in milliseconds.

The goal: an agent framework that feels like a library, not a platform.

## Why Vibes?

1. **Type-safe tools + Dependency injection** — Every tool parameter is validated at runtime with Zod. Carry databases, HTTP clients, and config via `RunContext` through the entire call chain. No `any` types, no global state.
2. **Automatic retries + Cost control** — Retries on validation failure and enforces token budgets and request limits to keep costs in check.
3. **Structured output + Streaming** — Define a Zod schema, get back a typed object or stream typed partial objects to the client as they arrive.
4. **Testing + Evals — the only way to ship AI to production** — Unit-test every agent in CI with `TestModel` and `setAllowModelRequests(false)` (no real API calls). Then go further with typed eval datasets, built-in and LLM-as-judge evaluators, and experiment runners with configurable concurrency. Evals are code — they live in your repo, run in CI, and catch regressions before they reach users.
5. **Model-agnostic** — Switch between Anthropic, OpenAI, Google, Groq, Mistral, Ollama, and 50+ providers by changing one line.
6. **OpenTelemetry observability** — Every run emits OTel spans, events, and token usage metrics. Works with Jaeger, Honeycomb, Datadog, and any OTel-compatible backend.
7. **Durable agents + MCP, AG-UI, A2A** — Run long-lived agents that survive crashes and restarts with Temporal. Connect to MCP servers and build AG-UI and A2A agents out of the box.

## Packages

| Package | Description |
|---------|-------------|
| [`@vibesjs/sdk`](./packages/sdk) | The core agent framework |

## Quick start

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

## Type-safe tools + structured output

This is where Vibes shines. Tools are validated with Zod, output is a typed schema, and dependency injection means your real services flow through without globals.

```ts
import { Agent, tool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// --- Dependencies ---
type Deps = {
  db: { getUser: (id: string) => Promise<{ name: string; plan: string }> };
};

// --- Tools ---
const getUserInfo = tool({
  name: "get_user_info",
  description: "Fetch user details from the database",
  parameters: z.object({ userId: z.string() }),
  execute: async (ctx, { userId }) => ctx.deps.db.getUser(userId),
});

// --- Structured output schema ---
const SupportResponse = z.object({
  greeting: z.string(),
  recommendation: z.string(),
  escalate: z.boolean().describe("Whether to escalate to a human agent"),
});

// --- Agent ---
const supportAgent = new Agent<Deps>({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a customer support agent. Be concise and helpful.",
  tools: [getUserInfo],
  outputSchema: SupportResponse,
});

// --- Run with injected deps ---
const result = await supportAgent.run("Help user-42 with their billing question", {
  deps: {
    db: { getUser: async (id) => ({ name: "Ada", plan: "pro" }) },
  },
});

console.log(result.output.greeting);        // "Hi Ada!"
console.log(result.output.escalate);        // false
```

See [`packages/sdk`](./packages/sdk) for full documentation, examples, and API reference.

## Maintained by AI agents

Vibes was created and is maintained by AI agents under the supervision of [Atul (@a7ul)](https://github.com/a7ul). Every commit is reviewed by a human; every line was written by an agent.

When Pydantic AI ships a new release, a GitHub Actions workflow automatically detects it, opens an issue with a full porting checklist, and assigns the GitHub Copilot coding agent to implement it. The resulting PR is reviewed and merged by a human.

## Acknowledgements

Vibes is built on the shoulders of excellent open-source work:

- **[Pydantic AI](https://ai.pydantic.dev/)** — the design philosophy, API shape, and abstractions that Vibes is modeled after. If you like Vibes, go star Pydantic AI.
- **[Vercel AI SDK](https://sdk.vercel.ai/)** — the model layer powering all providers, streaming, and structured output.
- **[Zod](https://zod.dev/)** — runtime schema validation used throughout for tools, output, and dependencies.

## License

MIT
