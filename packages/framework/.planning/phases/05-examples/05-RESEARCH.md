# Phase 5: Examples - Research

**Researched:** 2026-03-14
**Domain:** Documentation authoring — nine runnable example pages covering the Vibes framework feature surface
**Confidence:** HIGH (all APIs verified directly from framework source code and existing concept/integration pages)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EX-01 | Examples landing page with categorized links to all 9 examples | Standard Mintlify `<CardGroup>` + `<Card>` pattern; categories derived from example groupings in REQUIREMENTS.md |
| EX-02 | Hello world — simplest possible agent (5 lines, copy-paste runnable) | `Agent`, `agent.run()`, `result.output` verified in `lib/agent.ts`; import style verified in `docs/index.mdx` and `docs/getting-started/hello-world.mdx` |
| EX-03 | Weather agent — tools + external API + structured output | `tool()`, `outputSchema`, Zod schema verified in `lib/tool.ts`, `lib/agent.ts`, and `docs/getting-started/hello-world.mdx` |
| EX-04 | Chat app — multi-turn + Vercel AI frontend | `messageHistory`, `agent.stream()`, `toDataStreamResponse()`, `useChat` verified in `docs/concepts/messages.mdx` and `docs/integrations/vercel-ai-ui.mdx` |
| EX-05 | Bank support — canonical pydantic-ai example ported to TS | Pydantic-ai source fetched from ai.pydantic.dev/examples/bank-support/; Vibes equivalents: `Agent<TDeps>`, `tool<TDeps>()`, `outputSchema`, `instructions` function verified in `lib/agent.ts` and `docs/concepts/dependencies.mdx` |
| EX-06 | RAG — tools + vector search pattern | `tool()` for retrieval; no Vibes-specific RAG adapter; pattern uses `plainTool()` with external vector search; verified against `docs/concepts/tools.mdx` |
| EX-07 | Graph workflow — multi-step FSM pipeline using BaseNode/Graph | `BaseNode`, `Graph`, `next()`, `output()`, `FileStatePersistence` verified in `lib/graph/mod.ts` and `docs/concepts/graph.mdx` |
| EX-08 | Human-in-the-loop — end-to-end deferred approval flow | `requiresApproval`, `ApprovalRequiredError`, `DeferredToolRequests`, `agent.resume()` verified in `lib/execution/deferred.ts` and `docs/concepts/human-in-the-loop.mdx` |
| EX-09 | A2A — two agents via A2A protocol | `A2AAdapter`, `MemoryTaskStore`, `adapter.handler()`, fetch-based client verified in `lib/a2a/adapter.ts` and `docs/integrations/a2a.mdx` |
</phase_requirements>

---

## Summary

Phase 5 creates nine example documentation pages and one landing page. All examples document real Vibes framework APIs — every API used can be verified against source code in `lib/` and the concept/integration docs written in earlier phases. No new framework APIs need to be invented or discovered.

The primary authoring task is writing complete, copy-paste runnable programs with a consistent pedagogical structure: imports → setup → execution → output annotations. Each example should be runnable with `deno run --allow-net --allow-env example.ts` (or equivalent), with clear prerequisite instructions for API keys.

The bank support example (EX-05) is the most pedagogically important — it is pydantic-ai's canonical teaching example and must faithfully demonstrate the three core Vibes features: dynamic `instructions` function, `outputSchema` for structured output, and `tool<TDeps>()` for dependency injection. The pydantic-ai source has been fetched and the TypeScript mapping is documented in the Code Examples section below.

The A2A example (EX-09) is the most technically complex — it requires two agents: a server (wrapped with `A2AAdapter`) and a client (using `fetch` to call the A2A JSON-RPC interface). Both must be shown in the same example page.

**Primary recommendation:** Write each example as a single complete TypeScript file. Keep examples standalone — no shared code between examples. Use `npm:@vibes/framework` import style (Deno-native). Model selections should match what existing docs use: `claude-sonnet-4-6` for general examples, `claude-haiku-4-5-20251001` for lightweight examples.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vibes/framework` | `npm:@vibes/framework` | Framework being documented | The subject of all examples |
| `@ai-sdk/anthropic` | `npm:@ai-sdk/anthropic` | Anthropic model provider | Default provider used throughout existing docs |
| `zod` | `npm:zod@^4` | Parameter validation and output schemas | Already in deno.json; used in all existing code examples |
| `ai` | `npm:ai@^6` | `toDataStreamResponse()` for Chat app example | Already in deno.json |

### Supporting (by example)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ai/react` (Vercel AI UI) | `npm:ai@^6/react` | `useChat` frontend hook | EX-04 Chat App frontend section only |
| React / Next.js | (user installs) | Frontend framework for Chat App | EX-04 frontend code snippets |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ai-sdk/anthropic` | `@ai-sdk/openai` | Anthropic is the default shown throughout existing docs — keep consistency |
| Deno-native imports | Node.js `import` | Vibes is Deno-first; all existing docs use Deno/npm import syntax |

**Installation:**
```bash
# Deno (no install needed — import inline)
import { Agent } from "npm:@vibes/framework";

# npm
npm install @vibes/framework @ai-sdk/anthropic zod
```

---

## Architecture Patterns

### Recommended Docs Structure
```
docs/
└── examples/
    ├── index.mdx          # EX-01: landing page with CardGroup
    ├── hello-world.mdx    # EX-02
    ├── weather-agent.mdx  # EX-03
    ├── chat-app.mdx       # EX-04
    ├── bank-support.mdx   # EX-05
    ├── rag.mdx            # EX-06
    ├── graph-workflow.mdx # EX-07
    ├── hitl.mdx           # EX-08
    └── a2a.mdx            # EX-09
```

### Pattern 1: Example Page Structure
**What:** Every example page follows a consistent structure for predictability.
**When to use:** All 9 example pages (EX-02 through EX-09).

```mdx
---
title: "[Example Name]"
description: "[One-line summary of what it demonstrates]"
---

[1-2 paragraph intro explaining what the example shows and which Vibes features it demonstrates]

## What You'll Learn
- [Feature 1]
- [Feature 2]

## Prerequisites
- Vibes installed ([Installation guide](/getting-started/install))
- `ANTHROPIC_API_KEY` set in environment

## Complete Example

```typescript
// [complete, self-contained, runnable program]
```

## Run It

```bash
deno run --allow-net --allow-env example.ts
```

## How It Works
[Section-by-section walkthrough of key concepts in the code]
```

### Pattern 2: Landing Page with Categorized Cards
**What:** `examples/index.mdx` groups examples by feature category using Mintlify `<CardGroup>`.
**When to use:** EX-01 only.

```mdx
<CardGroup cols={2}>
  <Card title="Hello World" icon="rocket" href="/examples/hello-world">
    The simplest possible agent in 5 lines
  </Card>
  ...
</CardGroup>
```

### Pattern 3: Multi-File Example (Chat App)
**What:** EX-04 (Chat App) shows multiple files: agent definition, API route, React component.
**When to use:** EX-04 only — other examples are single-file.
**Use Mintlify `<CodeGroup>` to group related files:**

```mdx
<CodeGroup>
```typescript agent.ts
// agent definition
```

```typescript app/api/chat/route.ts
// Next.js route
```

```typescript app/page.tsx
// React component
```
</CodeGroup>
```

### Pattern 4: A2A Two-Process Example
**What:** EX-09 shows two separate files: `server.ts` (agent wrapped with A2AAdapter) and `client.ts` (fetch-based A2A client).
**When to use:** EX-09 only.

### Anti-Patterns to Avoid
- **Incomplete imports:** Every example must include every import statement needed to run the file cold.
- **Placeholder API calls:** Don't use `// TODO: call real API here` — use inline mock data or a real public API (e.g. Open-Meteo for weather, which is free and needs no API key).
- **Invented APIs:** Every identifier used must exist in `mod.ts` exports. The previous docs had this problem extensively — avoid it.
- **Mismatched model IDs:** Use `claude-sonnet-4-6` or `claude-haiku-4-5-20251001` — matching the pattern established in concepts/agents.mdx and hello-world.mdx.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector search in RAG example | Custom embedding + similarity search | Show `plainTool()` calling a mock vector DB function; annotate with note that real impl uses any vector DB | RAG example is about the tool integration pattern, not the vector DB itself |
| Weather API in weather example | Custom HTTP client | Open-Meteo API (`https://api.open-meteo.com/v1/forecast`) — no API key required | Keeps example copy-pasteable without setup |
| A2A client protocol | Custom fetch wrapper | Plain `fetch()` with JSON-RPC body shape shown explicitly | The raw fetch IS the teaching point — developers need to see the wire format |
| Chat history persistence | Custom serialization | `serializeMessages()`/`deserializeMessages()` from `@vibes/framework` | Already implemented and documented in concepts/messages.mdx |

**Key insight:** Examples teach the Vibes API, not the underlying problem domain. Minimize external setup requirements — examples that require zero additional API keys beyond `ANTHROPIC_API_KEY` are preferable.

---

## Common Pitfalls

### Pitfall 1: Using the Wrong Model ID
**What goes wrong:** Model ID strings like `claude-3-sonnet` or `claude-haiku` don't exist in the provider SDK — the run will throw at startup.
**Why it happens:** Training data contains old model names.
**How to avoid:** Use exactly `claude-sonnet-4-6` (from `@ai-sdk/anthropic`) or `claude-haiku-4-5-20251001` as shown in all existing docs pages.
**Warning signs:** Any model ID not matching the form used in concept pages.

### Pitfall 2: `this.next()` in Graph Nodes
**What goes wrong:** Using `this.next()` or `this.output()` inside a BaseNode throws at runtime — these are not methods on `BaseNode`.
**Why it happens:** Old API bug that was fixed; earlier docs used the wrong API.
**How to avoid:** Import `next` and `output` as free functions from `@vibes/framework`, not as methods. Already documented in concepts/graph.mdx with a prominent Info callout.
**Warning signs:** Any `this.next(...)` or `this.output(...)` in graph node code.

### Pitfall 3: `agent.instructions` vs `instructions` Option
**What goes wrong:** Passing a dynamic instructions function. The bank support example needs `instructions: (ctx) => ...` in `AgentOptions`, not a decorator pattern.
**Why it happens:** pydantic-ai uses `@agent.system_prompt` decorator; Vibes uses a function in the constructor options.
**How to avoid:** `instructions: async (ctx) => \`Customer: ${ctx.deps.customerName}\`` as an `AgentOptions` field.
**Warning signs:** Decorator syntax or `agent.instructions(...)` method call.

### Pitfall 4: Missing `--allow-net --allow-env` Deno Flags
**What goes wrong:** Deno blocks network and env var access without explicit permission flags.
**Why it happens:** Node.js doesn't need these flags.
**How to avoid:** Always include `deno run --allow-net --allow-env example.ts` in run instructions.
**Warning signs:** Run commands showing just `deno run example.ts`.

### Pitfall 5: A2A Server and Client in Same Process
**What goes wrong:** Running `A2AAdapter` server and client in the same process produces a confusing example where the server never starts listening before the client connects.
**Why it happens:** The test-like structure tempts writing both in one file.
**How to avoid:** Show server (`server.ts`) and client (`client.ts`) as separate files. Use `<CodeGroup>` tabs to present both. Add a note about running server first.
**Warning signs:** `Deno.serve()` and `fetch()` calls both in the same example file.

### Pitfall 6: RAG Vector Search Complexity
**What goes wrong:** Attempting to use a real vector database (Pinecone, pgvector, etc.) creates a massive setup burden that obscures the Vibes patterns being taught.
**Why it happens:** "RAG" implies needing a real vector store.
**How to avoid:** Use an in-memory mock `vectorSearch()` function and annotate clearly: "In production, replace this with your vector DB client." The Vibes pattern (tool retrieves context, agent uses it) is identical regardless of the vector store used.
**Warning signs:** Any external vector DB SDK imports in the RAG example.

---

## Code Examples

Verified patterns from framework source and existing docs:

### EX-02: Hello World (5-line agent)
```typescript
// Source: docs/index.mdx pattern
import { Agent } from "npm:@vibes/framework";
import { anthropic } from "npm:@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run("What is the capital of France?");
console.log(result.output); // "Paris"
```

### EX-03: Weather Agent (tools + structured output)
```typescript
// Source: docs/getting-started/hello-world.mdx pattern extended
import { Agent, tool } from "npm:@vibes/framework";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "npm:zod";

const getWeather = tool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    latitude: z.number(),
    longitude: z.number(),
    city: z.string(),
  }),
  execute: async (_ctx, { latitude, longitude, city }) => {
    // Open-Meteo — free, no API key needed
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m`;
    const data = await fetch(url).then(r => r.json());
    return `${city}: ${data.current.temperature_2m}°C, wind ${data.current.wind_speed_10m} km/h`;
  },
});

const WeatherReport = z.object({
  city: z.string(),
  temperature: z.number(),
  condition: z.string(),
  summary: z.string(),
});

const agent = new Agent<undefined, z.infer<typeof WeatherReport>>({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a weather assistant. Use the get_weather tool with exact coordinates.",
  tools: [getWeather],
  outputSchema: WeatherReport,
});

const result = await agent.run("What's the weather in Tokyo?");
console.log(result.output);
```

### EX-05: Bank Support (pydantic-ai canonical example ported to TS)
**pydantic-ai original features mapped to Vibes equivalents:**

| pydantic-ai | Vibes equivalent |
|------------|-----------------|
| `SupportDependencies(dataclass)` | `type Deps = { customerId: number; db: DatabaseConn }` |
| `@support_agent.system_prompt` | `systemPrompt: "..."` string |
| `@support_agent.instructions` decorator | `instructions: async (ctx) => ...` function in AgentOptions |
| `SupportOutput(BaseModel)` | `z.object({ supportAdvice, blockCard, risk })` Zod schema |
| `support_agent = Agent(model, output_type=SupportOutput, deps_type=SupportDeps)` | `new Agent<Deps, SupportOutput>({ model, outputSchema, instructions })` |
| `agent.run_sync(...)` | `await agent.run(...)` |

```typescript
// Source: pydantic-ai bank-support example, ported to Vibes APIs
import { Agent, tool } from "npm:@vibes/framework";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "npm:zod";

// --- Database (mock) ---
class DatabaseConn {
  async customerName(id: number): Promise<string> {
    const names: Record<number, string> = { 123: "Alice", 456: "Bob" };
    return names[id] ?? "Unknown";
  }
  async customerBalance(id: number): Promise<number> {
    const balances: Record<number, number> = { 123: 1250.50, 456: 89.00 };
    return balances[id] ?? 0;
  }
}

// --- Dependencies ---
type Deps = { customerId: number; db: DatabaseConn };

// --- Output schema ---
const SupportOutput = z.object({
  supportAdvice: z.string().describe("Advice to give the customer"),
  blockCard: z.boolean().describe("Whether to block the customer's card"),
  risk: z.number().int().min(0).max(10).describe("Risk level 0-10"),
});

// --- Agent ---
const supportAgent = new Agent<Deps, z.infer<typeof SupportOutput>>({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a support agent in our bank. Give the customer support and judge the risk level of their query. Reply using the customer's name.",
  instructions: async (ctx) => {
    const name = await ctx.deps.db.customerName(ctx.deps.customerId);
    return `The customer's name is ${name}.`;
  },
  tools: [
    tool<Deps>({
      name: "customer_balance",
      description: "Returns the customer's current account balance",
      parameters: z.object({}),
      execute: async (ctx) => {
        const balance = await ctx.deps.db.customerBalance(ctx.deps.customerId);
        return `$${balance.toFixed(2)}`;
      },
    }),
  ],
  outputSchema: SupportOutput,
});

// --- Run ---
const db = new DatabaseConn();
const result = await supportAgent.run("What is my balance?", {
  deps: { customerId: 123, db },
});
console.log(result.output);
// { supportAdvice: "Your balance is $1250.50.", blockCard: false, risk: 1 }
```

### EX-07: Graph Workflow (FSM pipeline)
```typescript
// Source: docs/concepts/graph.mdx — verified API
import { Agent, BaseNode, Graph, next, output } from "npm:@vibes/framework";
import { anthropic } from "npm:@ai-sdk/anthropic";

type PipelineState = {
  topic: string;
  outline?: string;
  article?: string;
};

const outlineAgent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "Create a concise 3-point outline for an article.",
});

const writeAgent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "Write a short article based on the outline provided.",
});

class OutlineNode extends BaseNode<PipelineState, string> {
  readonly id = "outline";
  readonly nextNodes = ["write"];

  async run(state: PipelineState) {
    const result = await outlineAgent.run(`Topic: ${state.topic}`);
    return next<PipelineState, string>("write", { ...state, outline: result.output });
  }
}

class WriteNode extends BaseNode<PipelineState, string> {
  readonly id = "write";

  async run(state: PipelineState) {
    const result = await writeAgent.run(`Outline:\n${state.outline}\n\nWrite the article.`);
    return output<PipelineState, string>(result.output);
  }
}

const graph = new Graph<PipelineState, string>([new OutlineNode(), new WriteNode()]);
const article = await graph.run({ topic: "The future of AI agents" }, "outline");
console.log(article);
```

### EX-08: Human-in-the-Loop (deferred approval)
```typescript
// Source: docs/concepts/human-in-the-loop.mdx — verified API
import { Agent, ApprovalRequiredError, tool } from "npm:@vibes/framework";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "npm:zod";

const sendEmail = tool({
  name: "send_email",
  description: "Send an email to a recipient",
  parameters: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  execute: async (_ctx, { to, subject }) => {
    console.log(`Email sent to ${to}: "${subject}"`);
    return "Email sent successfully.";
  },
  requiresApproval: true,
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are an email assistant.",
  tools: [sendEmail],
});

try {
  await agent.run("Send a welcome email to alice@example.com");
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    const { deferred } = err;
    for (const req of deferred.requests) {
      console.log(`Approval required for: ${req.toolName}`);
      console.log("Args:", req.args);
    }
    // Simulate human approval
    const approved = true;
    if (approved) {
      const results = {
        results: deferred.requests.map(req => ({
          toolCallId: req.toolCallId,
          result: "approved",
        })),
      };
      const finalResult = await agent.resume(deferred, results);
      console.log(finalResult.output);
    }
  }
}
```

### EX-09: A2A (two agents communicating)
```typescript
// Source: docs/integrations/a2a.mdx — verified API
// server.ts
import { A2AAdapter, Agent } from "npm:@vibes/framework";
import { anthropic } from "npm:@ai-sdk/anthropic";

const researchAgent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a research assistant. Answer factual questions concisely.",
});

const adapter = new A2AAdapter(researchAgent, {
  name: "Research Agent",
  description: "Answers factual research questions",
  url: "http://localhost:8000",
  version: "1.0.0",
});

Deno.serve({ port: 8000 }, adapter.handler());
console.log("A2A server running on http://localhost:8000");
```

```typescript
// client.ts
const response = await fetch("http://localhost:8000/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "message/send",
    id: "req-1",
    params: {
      message: {
        role: "user",
        parts: [{ kind: "text", text: "What year was the Eiffel Tower built?" }],
      },
    },
  }),
});

const { result } = await response.json();
console.log(result.artifacts[0].parts[0].text);
```

### EX-01: Landing Page Card Structure
```mdx
---
title: Examples
description: Copy-paste runnable examples covering the full Vibes feature surface, from hello world to multi-agent A2A.
---

<CardGroup cols={2}>
  <Card title="Hello World" icon="rocket" href="/examples/hello-world">
    The simplest possible agent — 5 lines
  </Card>
  <Card title="Weather Agent" icon="cloud" href="/examples/weather-agent">
    Tools + external API + structured output
  </Card>
  <Card title="Chat App" icon="messages" href="/examples/chat-app">
    Multi-turn conversation with Vercel AI frontend
  </Card>
  <Card title="Bank Support" icon="building-columns" href="/examples/bank-support">
    Canonical pydantic-ai teaching example ported to TypeScript
  </Card>
  <Card title="RAG" icon="database" href="/examples/rag">
    Retrieval-augmented generation with vector search
  </Card>
  <Card title="Graph Workflow" icon="diagram-project" href="/examples/graph-workflow">
    Multi-step FSM pipeline with BaseNode and Graph
  </Card>
  <Card title="Human-in-the-Loop" icon="user-check" href="/examples/hitl">
    End-to-end deferred approval flow
  </Card>
  <Card title="A2A" icon="arrows-spin" href="/examples/a2a">
    Two agents communicating via A2A protocol
  </Card>
</CardGroup>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agent examples in `guides/` | Dedicated `examples/` section with landing page | Phase 5 | Discoverability |
| Fragmented pattern demos | Each example: complete, standalone, copy-paste runnable | Phase 5 | Developer UX |
| `this.next()` in graph nodes | Imported `next()` free function | Phase 3 fix (API bug) | Graph examples must NOT use old API |

**Deprecated/outdated:**
- `guides/human-in-the-loop.mdx` and `guides/multi-agent-systems.mdx`: These old guides will be superseded by the examples but are NOT deleted in Phase 5 (that is Phase 6 NAV-02 work).
- `new Graph({ nodes: [...] })`: Old constructor form — always use `new Graph([...nodes], options?)` positional array form.

---

## Open Questions

1. **RAG example: which vector search mock to use?**
   - What we know: No Vibes-specific vector store adapter exists; RAG is always a tool pattern
   - What's unclear: Whether to use a completely in-memory mock or reference a specific vector DB (Qdrant, Pinecone, etc.)
   - Recommendation: Use a fully in-memory mock array scan. Annotate with a note pointing to docs on replacing it with a real vector DB. This maximizes copy-paste-runnability with zero additional setup.

2. **Chat app (EX-04): Next.js or Deno server?**
   - What we know: `docs/integrations/vercel-ai-ui.mdx` shows both Next.js App Router and Deno server variants
   - What's unclear: Whether EX-04 should be Next.js-centric (matching the Vercel AI UI docs) or show both
   - Recommendation: Show the Deno server variant as the primary (matches Vibes' Deno-first stance) with a secondary `<CodeGroup>` tab showing the Next.js App Router route. Keep the React frontend component the same.

3. **EX-09 A2A: single page showing two files vs. two separate tutorials?**
   - What we know: Two processes are required; `<CodeGroup>` allows showing multiple files on one page
   - What's unclear: Whether this is confusing for developers new to A2A
   - Recommendation: Single page, two `<CodeGroup>` tabs (`server.ts` and `client.ts`), with explicit "Run server first, then client" instructions.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno built-in test runner |
| Config file | `deno.json` (`tasks.test: "deno test -A"`) |
| Quick run command | `deno test -A --filter "examples"` |
| Full suite command | `deno task test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EX-01 | Landing page renders with 8 card links | manual | N/A — visual Mintlify check | ❌ Wave 0 |
| EX-02 | Hello world page has complete imports + runnable code | manual | N/A — doc review | ❌ Wave 0 |
| EX-03 | Weather agent page has tool + structured output pattern | manual | N/A — doc review | ❌ Wave 0 |
| EX-04 | Chat app page has multi-turn + Vercel AI code | manual | N/A — doc review | ❌ Wave 0 |
| EX-05 | Bank support correctly demonstrates deps injection | manual | N/A — doc review | ❌ Wave 0 |
| EX-06 | RAG page shows tool-based retrieval pattern | manual | N/A — doc review | ❌ Wave 0 |
| EX-07 | Graph workflow uses `next()` free function (not `this.next()`) | manual | Grep for `this.next` in graph-workflow.mdx | ❌ Wave 0 |
| EX-08 | HITL page shows `agent.resume()` end-to-end | manual | N/A — doc review | ❌ Wave 0 |
| EX-09 | A2A page shows both server and client | manual | N/A — doc review | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Grep check for known bad patterns (`this.next`, `depsFactory`, invented API names)
- **Per wave merge:** Full manual review of generated pages in `mintlify dev`
- **Phase gate:** All 9 example pages render in Mintlify preview before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `docs/examples/` directory — does not exist yet, needs to be created
- [ ] `docs.json` Examples group entry — needs to be added (alongside existing groups)

*(Note: No test files are needed — this phase produces documentation, not executable tests. The "tests" are doc review checks.)*

---

## Sources

### Primary (HIGH confidence)
- Framework source: `mod.ts` — all exported APIs verified
- Framework source: `lib/graph/mod.ts` — Graph, BaseNode, next, output, FileStatePersistence APIs
- Framework source: `lib/a2a/adapter.ts`, `lib/a2a/types.ts` — A2AAdapter, MemoryTaskStore
- Framework source: `lib/execution/deferred.ts` — DeferredToolRequests, ApprovalRequiredError, agent.resume()
- `docs/concepts/graph.mdx` — Graph API with Info callout on bugs (already fixed in Phase 3)
- `docs/concepts/human-in-the-loop.mdx` — HITL complete API reference
- `docs/integrations/a2a.mdx` — A2A adapter, JSON-RPC methods, SSE events
- `docs/integrations/vercel-ai-ui.mdx` — toDataStreamResponse, useChat, multi-turn pattern
- `docs/getting-started/hello-world.mdx` — established 4-step progressive pattern
- `docs/concepts/dependencies.mdx` — RunContext, deps injection, instructions function
- `deno.json` — import versions and available packages

### Secondary (MEDIUM confidence)
- `https://ai.pydantic.dev/examples/bank-support/` — pydantic-ai original example fetched live; TypeScript port derived from this

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all imports verified in deno.json and existing docs
- Architecture: HIGH — consistent with established concept/integration doc patterns
- Pitfalls: HIGH — API bugs documented in STATE.md decisions and concept pages; verified against source

**Research date:** 2026-03-14
**Valid until:** 2026-06-14 (stable framework API; 90 days before re-verification needed)
