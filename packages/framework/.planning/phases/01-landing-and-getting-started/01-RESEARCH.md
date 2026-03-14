# Phase 1: Landing and Getting Started - Research

**Researched:** 2026-03-14
**Domain:** Documentation (Mintlify MDX), developer onboarding, pydantic-ai pedagogical style
**Confidence:** HIGH

## Summary

Phase 1 rewrites the first-impression pages of the Vibes Agent Framework docs: a benefits-first landing page (index.mdx), a new introduction page, an enhanced install page with provider architecture diagram, and a single progressive hello-world tutorial that replaces four fragmented getting-started pages. The north star is pydantic-ai's landing and install pages, adapted for TypeScript/Deno.

The existing docs have decent content but are fragmented (4 separate getting-started pages), lack visual aids (no Mermaid diagrams), and miss the "why" (no benefits hero, no acknowledgments, no design philosophy). The public API surface needed for hello-world examples is small and stable: `Agent`, `tool`, `TestModel`, `agent.override()`, `outputSchema` with Zod, and `setAllowModelRequests`.

**Primary recommendation:** Consolidate the four getting-started pages into one progressive tutorial that builds a weather agent from scratch: bare agent -> add tools -> add structured output -> test it. Use Mermaid diagrams on the landing page (architecture) and install page (provider layer). Credit pydantic-ai and Vercel AI SDK prominently.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAND-01 | Landing page with benefits-first hero, Mermaid architecture diagram, pydantic-ai/Vercel AI SDK acknowledgment | Pydantic-ai landing page structure studied; existing index.mdx analyzed; Mermaid syntax for architecture diagrams documented below |
| LAND-02 | Introduction page with design philosophy and "Standing on the Shoulders of Giants" section | Pydantic-ai positioning studied ("that FastAPI feeling"); existing comparison table in index.mdx provides content to move here |
| GS-01 | Install page enhanced with supported provider list and Mermaid provider architecture diagram | Existing install.mdx has Deno/Node tabs; needs provider list (Anthropic, OpenAI, Google, Groq, Mistral, Ollama, OpenAI-compatible) and Mermaid diagram |
| GS-02 | Single progressive hello-world tutorial replacing 4 fragmented pages | All 4 existing pages analyzed; progressive weather agent example designed below; API surface verified against mod.ts |
</phase_requirements>

## Standard Stack

### Core (docs tooling)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Mintlify | current | Documentation site framework | Already configured in docs/docs.json |
| MDX | - | Markdown + JSX components | Mintlify's page format |
| Mermaid | - | Diagrams in MDX | Required by LAND-01 and GS-01; Mintlify renders Mermaid natively in ```mermaid code blocks |

### Framework API (used in code examples)
| Export | From | Purpose in Phase 1 |
|--------|------|---------------------|
| `Agent` | `@vibes/framework` | Core class for all examples |
| `tool` | `@vibes/framework` | Tool factory for weather example |
| `TestModel` | `@vibes/framework` | Testing without API calls |
| `setAllowModelRequests` | `@vibes/framework` | Block accidental real calls in tests |
| `captureRunMessages` | `@vibes/framework` | Inspect messages in tests |
| `z` (Zod) | `zod` | Schema for structured output and tool params |
| `anthropic` | `@ai-sdk/anthropic` | Provider for examples |

## Architecture Patterns

### Recommended Page Structure for Phase 1

```
docs/
  index.mdx                          # REWRITE - benefits hero + arch diagram + acknowledgments
  introduction.mdx                   # NEW - design philosophy + "Standing on Shoulders of Giants"
  getting-started/
    install.mdx                      # REWRITE - provider list + Mermaid provider diagram
    hello-world.mdx                  # NEW - single progressive tutorial (replaces 4 pages)
    first-agent.mdx                  # DELETE (content merged into hello-world)
    adding-tools.mdx                 # DELETE (content merged into hello-world)
    structured-output.mdx            # DELETE (content merged into hello-world)
    testing.mdx                      # DELETE (content merged into hello-world)
```

### Pattern 1: Pydantic-ai Landing Page Structure
**What:** Benefits-first hero section followed by code examples, then navigation links
**Structure observed from pydantic-ai:**
1. Logo + tagline ("GenAI Agent Framework, the Pydantic way")
2. "Why use X" section with numbered benefits
3. Minimal hello-world code example
4. Richer example (banking support agent with tools + DI)
5. Instrumentation/observability teaser
6. Sidebar navigation to deeper content

**Adapted for Vibes:**
1. Hero: "TypeScript Agent Framework, the pydantic-ai way. Powered by Vercel AI SDK."
2. Benefits list (type-safe tools, DI, model-agnostic via AI SDK, testing utilities, streaming, MCP/A2A/AG-UI)
3. Mermaid architecture diagram showing the layer stack
4. Minimal hello-world (5 lines)
5. Acknowledgments blurb crediting pydantic-ai and Vercel AI SDK
6. Card links to Install and Hello World tutorial

### Pattern 2: Progressive Tutorial Structure
**What:** One example built incrementally across sections, not separate pages
**pydantic-ai approach:** Hello world -> bank support agent in a single flow
**Vibes adaptation for GS-02:**

Section progression using a weather agent:
1. **Bare agent** - 5 lines, `Agent` + `agent.run()`, text output
2. **Add a tool** - `tool()` with Zod params, agent calls `get_weather`
3. **Add structured output** - `outputSchema` with `z.object`, typed `result.output`
4. **Test it** - `TestModel`, `agent.override()`, `setAllowModelRequests(false)`

This mirrors pydantic-ai's teaching approach: start simple, layer complexity, end with testing.

### Pattern 3: Mermaid Diagrams in Mintlify
**What:** Mintlify renders Mermaid natively inside fenced code blocks with `mermaid` language tag.

**Architecture diagram for landing page (LAND-01):**
```
graph TD
    A[Your Code] --> B["@vibes/framework"]
    B --> C[Vercel AI SDK]
    C --> D[Anthropic]
    C --> E[OpenAI]
    C --> F[Google]
    C --> G[Groq / Mistral / Ollama / ...]
```

**Provider architecture diagram for install page (GS-01):**
```
graph LR
    subgraph "@vibes/framework"
        Agent --> Tools
        Agent --> DI[Dependency Injection]
        Agent --> Validation
    end
    subgraph "Vercel AI SDK"
        Agent --> Model[LanguageModel]
    end
    subgraph Providers
        Model --> Anthropic["@ai-sdk/anthropic"]
        Model --> OpenAI["@ai-sdk/openai"]
        Model --> Google["@ai-sdk/google"]
        Model --> Groq["@ai-sdk/groq"]
        Model --> Mistral["@ai-sdk/mistral"]
        Model --> Ollama["ollama-ai-provider"]
    end
```

### Anti-Patterns to Avoid
- **Fragmented getting-started:** Current 4-page split forces readers to click through pages for a single concept flow. Consolidate into one progressive tutorial.
- **Reference-style intro:** Current index.mdx jumps to a comparison table too early. Lead with benefits, show code, then compare.
- **Missing "why":** Never explain design philosophy or credit upstream projects. The introduction page fixes this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diagrams | ASCII art or custom SVG | Mermaid code blocks | Mintlify renders natively, maintainable as text |
| Code tabs (Deno/Node) | Custom HTML | Mintlify `<Tabs>` + `<Tab>` components | Already used in existing install.mdx |
| Step-by-step layout | Manual numbered sections | Mintlify `<Steps>` + `<Step>` components | Built-in progressive disclosure UI |
| Card navigation | Manual link lists | Mintlify `<CardGroup>` + `<Card>` components | Consistent hover/click UX |
| Callouts/notes | Blockquotes | Mintlify `<Note>`, `<Warning>`, `<Tip>`, `<Info>` components | Styled consistently |
| Code groups | Multiple separate blocks | Mintlify `<CodeGroup>` component | Tabbed code display |

## Common Pitfalls

### Pitfall 1: Mermaid Rendering in Mintlify
**What goes wrong:** Mermaid diagrams may not render in `mintlify dev` local preview if the Mintlify version is old.
**How to avoid:** Test diagrams with `deno task docs:dev`. Keep diagrams simple (flowchart TD/LR, no advanced features). Avoid complex subgraph nesting.

### Pitfall 2: Import Path Inconsistency
**What goes wrong:** Examples mix `"@vibes/framework"` (npm) with `"jsr:@vibes/framework"` (Deno direct).
**How to avoid:** Use `"@vibes/framework"` in all code examples (works for both Deno with import map and Node with npm). Show the import map setup only on the install page.

### Pitfall 3: Model String Drift
**What goes wrong:** Hardcoding model identifiers like `"claude-haiku-4-5-20251001"` that become outdated.
**How to avoid:** Use the latest model string from @ai-sdk/anthropic. Current existing pages use `anthropic("claude-haiku-4-5-20251001")` consistently -- keep this consistent across the tutorial but note it may need updating.

### Pitfall 4: Deleting Pages Without Updating docs.json
**What goes wrong:** Removing `first-agent.mdx`, `adding-tools.mdx`, `structured-output.mdx`, `testing.mdx` without updating `docs/docs.json` navigation breaks the sidebar.
**How to avoid:** Update docs.json navigation in the same plan that deletes/creates pages. The new nav should reference `getting-started/hello-world` instead of the 4 old pages.

### Pitfall 5: Broken Internal Links After Page Moves
**What goes wrong:** Other pages (concepts, reference) link to `getting-started/first-agent`, `getting-started/adding-tools`, etc. which will 404 after deletion.
**How to avoid:** Grep the entire `docs/` directory for links to the 4 deleted pages and update them to point to `getting-started/hello-world` with appropriate anchors.

## Code Examples

### Minimal Hello World (5-line hero example for landing page)
```typescript
import { Agent } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run("What is the capital of France?");
console.log(result.output); // "Paris"
```

### Progressive Tutorial Step 1: Bare Agent
```typescript
import { Agent } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful weather assistant.",
});

const result = await agent.run("What's the weather like?");
console.log(result.output);
// The agent responds with text (no tools yet, so it can only guess)
```

### Progressive Tutorial Step 2: Add a Tool
```typescript
import { Agent, tool } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async (_ctx, { city }) => {
    // In production, call a real weather API
    return `${city}: 22°C, sunny`;
  },
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful weather assistant.",
  tools: [getWeather],
});

const result = await agent.run("What's the weather in Tokyo?");
console.log(result.output);
// "The weather in Tokyo is currently 22°C and sunny."
```

### Progressive Tutorial Step 3: Add Structured Output
```typescript
import { z } from "zod";

const WeatherReport = z.object({
  city: z.string(),
  temperature: z.number().describe("Temperature in Celsius"),
  condition: z.string().describe("e.g. sunny, cloudy, rainy"),
  summary: z.string().describe("A brief human-readable summary"),
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
console.log(result.output.condition);   // "sunny"
```

### Progressive Tutorial Step 4: Test It
```typescript
import { assertEquals } from "@std/assert";
import { TestModel, setAllowModelRequests } from "@vibes/framework";

// Block accidental real API calls
setAllowModelRequests(false);

Deno.test("weather agent returns structured output", async () => {
  const result = await agent
    .override({ model: new TestModel() })
    .run("What's the weather in Tokyo?");

  // TestModel auto-calls tools and produces schema-valid output
  assertEquals(typeof result.output.city, "string");
  assertEquals(typeof result.output.temperature, "number");
});
```

## Mintlify MDX Components Available

Key components to use in Phase 1 pages:

| Component | Usage | Where |
|-----------|-------|-------|
| `<Tabs>` + `<Tab title="...">` | Deno/Node.js install instructions | install.mdx |
| `<Steps>` + `<Step title="...">` | Progressive tutorial sections | hello-world.mdx |
| `<CardGroup cols={2}>` + `<Card title="..." href="...">` | Navigation cards on landing | index.mdx |
| `<Note>` | Important callouts | All pages |
| `<Tip>` | Helpful suggestions | hello-world.mdx |
| `<CodeGroup>` | Multiple code variants side by side | install.mdx |
| `<Info>` | Informational callouts | introduction.mdx |
| `<Frame>` | Wrapping diagrams or images | index.mdx (around Mermaid) |

Frontmatter format:
```yaml
---
title: "Page Title"
description: "SEO description"
---
```

## Supported Providers List (for GS-01)

From Vercel AI SDK ecosystem (verified against existing install.mdx and STACK.md):

| Provider | Package | Env Variable |
|----------|---------|-------------|
| Anthropic (Claude) | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | `@ai-sdk/openai` | `OPENAI_API_KEY` |
| Google (Gemini) | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Groq | `@ai-sdk/groq` | `GROQ_API_KEY` |
| Mistral | `@ai-sdk/mistral` | `MISTRAL_API_KEY` |
| Ollama (local) | `ollama-ai-provider` | (none - local) |
| Any OpenAI-compatible | `@ai-sdk/openai` with custom `baseURL` | varies |

Note: 50+ providers supported via Vercel AI SDK. These 7 are the most common and should be listed explicitly.

## State of the Art

| Old Approach (current docs) | New Approach (Phase 1) | Impact |
|----------------------------|------------------------|--------|
| 4 fragmented getting-started pages | 1 progressive tutorial | Matches pydantic-ai pedagogy |
| ASCII text diagram on landing | Mermaid rendered diagrams | Visual, maintainable |
| No design philosophy page | Dedicated introduction.mdx | Builds trust, explains "why" |
| No acknowledgments | Hero blurb + dedicated section | Credits pydantic-ai and Vercel AI SDK |
| No provider list on install | Full provider table with env vars | Answers "which models work?" immediately |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno built-in test runner |
| Config file | deno.json (task: `deno task test`) |
| Quick run command | `deno task docs:build` |
| Full suite command | `deno task docs:build` (Mintlify build catches broken pages) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAND-01 | Landing page renders with Mermaid diagram | smoke | `deno task docs:build` | N/A (docs build) |
| LAND-02 | Introduction page exists and renders | smoke | `deno task docs:build` | N/A (docs build) |
| GS-01 | Install page renders with provider diagram | smoke | `deno task docs:build` | N/A (docs build) |
| GS-02 | Hello-world tutorial page renders | smoke | `deno task docs:build` | N/A (docs build) |
| ALL | No broken internal links | integration | `grep -r 'first-agent\|adding-tools\|structured-output' docs/ --include='*.mdx'` | N/A |
| ALL | docs.json references only existing pages | integration | `deno task docs:build` (fails on missing pages) | N/A |

### Sampling Rate
- **Per task commit:** `deno task docs:build` (verifies all pages compile)
- **Per wave merge:** `deno task docs:build` + manual link check
- **Phase gate:** Full docs build green + visual review of all 4 pages

### Wave 0 Gaps
- None -- docs infrastructure (Mintlify, docs.json) already exists and works

## Open Questions

1. **Should old getting-started pages be deleted now or in Phase 6?**
   - What we know: REQUIREMENTS.md NAV-02 says "all old fragmented reference pages deleted" in Phase 6
   - Recommendation: Delete the 4 fragmented pages NOW in Phase 1 since we're replacing them with hello-world.mdx. Update docs.json nav simultaneously. Phase 6 NAV-02 handles the broader cleanup of reference/* pages.

2. **Introduction page vs expanding index.mdx?**
   - What we know: LAND-02 explicitly requires a separate introduction page
   - Recommendation: Keep index.mdx focused (hero + diagram + acknowledgments + nav cards). Move the comparison table and design philosophy to introduction.mdx.

3. **Which Mermaid diagram type works best in Mintlify?**
   - What we know: Mintlify supports Mermaid natively in ```mermaid blocks
   - Recommendation: Use `graph TD` (top-down) for architecture, `graph LR` (left-right) for provider layer. Test with `deno task docs:dev`.

## Sources

### Primary (HIGH confidence)
- mod.ts - verified all exports used in code examples
- Existing docs pages (index.mdx, install.mdx, first-agent.mdx, adding-tools.mdx, structured-output.mdx, testing.mdx) - analyzed current state
- docs/docs.json - current navigation structure
- STACK.md - framework dependencies and versions

### Secondary (MEDIUM confidence)
- https://ai.pydantic.dev/ - landing page structure and teaching approach
- https://ai.pydantic.dev/install/ - installation page structure

### Tertiary (LOW confidence)
- Mintlify component availability (based on existing usage in docs + Mintlify docs knowledge) - components like Steps, CardGroup should be verified against current Mintlify version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all from project files, no external research needed
- Architecture: HIGH - pydantic-ai structure directly observed, existing pages analyzed
- Pitfalls: HIGH - derived from analyzing current docs structure and code
- Code examples: HIGH - all API calls verified against mod.ts exports

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable - docs tooling and framework API unlikely to change)
