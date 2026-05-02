---
name: building-vibes-agents
description: Build AI agents with @vibesjs/sdk — tools, toolsets, structured output, streaming, testing, and multi-agent patterns. Use when the user mentions @vibesjs/sdk or Vibes, imports from @vibesjs/sdk, or asks to build an AI agent, add tools/toolsets, stream output, or test agent behavior.
license: MIT
compatibility: Requires Node.js 18+ or Deno 1.38+
metadata:
  version: "1.0.0"
  author: vibesjs
---

# Building AI Agents with @vibesjs/sdk

`@vibesjs/sdk` is a TypeScript agent framework for building production-grade, type-safe AI applications. It brings Pydantic AI patterns to TypeScript using the Vercel AI SDK.

## When to Use This Skill

Invoke this skill when:
- User asks to build an AI agent or mentions `@vibesjs/sdk` / Vibes
- User wants to add tools, toolsets, structured output, or streaming to an agent
- User asks about testing agents, dependencies, or message history
- Code imports from `@vibesjs/sdk` or references `Agent`, `tool`, `RunContext`
- User asks about multi-agent patterns, graph workflows, or MCP integration

Do **not** use this skill for:
- Other AI frameworks (LangChain, LlamaIndex, CrewAI, AutoGen)
- The Vercel AI SDK alone (without the `@vibesjs/sdk` agent framework)
- General TypeScript development unrelated to AI agents

## Quick-Start Patterns

### Create a Basic Agent

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  systemPrompt: "Be concise, reply with one sentence.",
});

const result = await agent.run('Where does "hello world" come from?');
console.log(result.output);
// The first known use of "hello, world" was in a 1974 C programming textbook.
```

### Add Tools to an Agent

```typescript
import { Agent, tool, plainTool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// plainTool — no context needed
const rollDice = plainTool({
  name: "roll_dice",
  description: "Roll a six-sided die and return the result.",
  parameters: z.object({}),
  execute: async () => String(Math.floor(Math.random() * 6) + 1),
});

// tool — receives RunContext for dependency access
type Deps = { playerName: string };

const getPlayerName = tool<Deps>({
  name: "get_player_name",
  description: "Get the player's name.",
  parameters: z.object({}),
  execute: async (ctx) => ctx.deps.playerName,
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  systemPrompt: "You are a dice game host.",
  tools: [rollDice, getPlayerName],
});

const result = await agent.run("My guess is 4", {
  deps: { playerName: "Anne" },
});
console.log(result.output);
```

### Structured Output with Zod Schemas

```typescript
import { Agent } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const CityLocation = z.object({
  city: z.string(),
  country: z.string(),
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  outputSchema: CityLocation,
});

const result = await agent.run("Where were the Olympics held in 2012?");
console.log(result.output.city);    // "London"
console.log(result.output.country); // "United Kingdom"
console.log(result.usage);          // { inputTokens, outputTokens, totalTokens, requests }
```

### Dependency Injection

```typescript
import { Agent, tool } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

type Deps = { db: { getUser(id: string): Promise<{ name: string }> } };

const getUserInfo = tool<Deps>({
  name: "get_user_info",
  description: "Look up the current user's profile.",
  parameters: z.object({ userId: z.string() }),
  execute: async (ctx, { userId }) => {
    return ctx.deps.db.getUser(userId);
  },
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a helpful assistant with access to user data.",
  tools: [getUserInfo],
});

const result = await agent.run("What is user 123's name?", {
  deps: { db: { getUser: async (id) => ({ name: "Alice" }) } },
});
```

### Testing with TestModel

```typescript
import { Agent, setAllowModelRequests, TestModel } from "@vibesjs/sdk";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

setAllowModelRequests(false);

const myAgent = new Agent({
  model: openai("gpt-4o"),
  systemPrompt: "Be helpful.",
});

// Use agent.override() to inject the test model
const result = await myAgent.override({ model: new TestModel() }).run("Test");
console.log(result.output); // "test response"
```

## Task Routing Table

Load only the most relevant reference first. Read additional references only if the task spans multiple areas.

| I want to... | Reference |
|---|---|
| Create/configure agents, choose output types, use deps, select models, or pick run methods | [Agents Core](./references/AGENTS-CORE.md) |
| Add function tools, choose between `tool` and `plainTool`, use `argsValidator` | [Tools Core](./references/TOOLS-CORE.md) |
| Use toolsets: `FunctionToolset`, `FilteredToolset`, `PrefixedToolset`, `WrapperToolset`, MCP | [Toolsets](./references/TOOLSETS.md) |
| Define structured output with Zod schemas or result validators | [Structured Output](./references/STRUCTURED-OUTPUT.md) |
| Test or debug agent behavior | [Testing and Debugging](./references/TESTING-AND-DEBUGGING.md) |
| Work with streaming, message history, or conversation context | [Message History and Streaming](./references/MESSAGE-HISTORY-AND-STREAMING.md) |
| Build multi-agent systems or graph-based workflows | [Multi-Agent and Graph](./references/MULTI-AGENT-AND-GRAPH.md) |

## Key Practices

- **Single entry point** — all imports come from `@vibesjs/sdk`
- **Zod for validation** — use `z.object({...})` for all tool parameters and output schemas
- **Vercel AI SDK models** — any model from `ai` SDK works: `anthropic(...)`, `openai(...)`, `google(...)`
- **Testing** — use `setAllowModelRequests(false)` + `TestModel`/`FunctionModel` in all tests
- **No `any`** — framework types are fully generic; use `unknown` + structural casts if needed

## Common Gotchas

These are mistakes that commonly produce silent failures or type errors.

- **Stream events use `.kind`, not `.type`** — always `event.kind === "text-delta"`, never `event.type`
- **`next()` and `output()` in graph nodes are free functions** — import them from `@vibesjs/sdk` and call them directly; they are NOT methods on a node object
- **`TOutput` is inferred from `outputSchema`** — never specify it as an explicit type parameter (`new Agent<Deps, MyType>()` is wrong)
- **`agent.override()` returns `{ run, stream, runStreamEvents }`** — it does NOT return an `Agent` instance; call `.run()` or `.stream()` on the returned object
- **`deps` goes at run time, not construction time** — `agent.run(prompt, { deps: myDeps })`, not the constructor
- **`setAllowModelRequests(false)` must be called in tests** — otherwise tests will make real API calls
- **`captureRunMessages` is not concurrency-safe** — run test cases using it sequentially
- **`tool<Deps>()` not `tool<Deps, Params>()`** — the second type parameter `TParams` is rarely needed; let TypeScript infer it from the `parameters` field
