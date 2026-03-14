# Installation

## Requirements

- [Deno](https://deno.land) 2.0 or later
- An API key for your chosen LLM provider

## Add to deno.json

Add `@vibes/framework` and the Vercel AI SDK packages to your project's `deno.json`:

```jsonc
{
  "imports": {
    "@vibes/framework": "jsr:@vibes/framework@^0.1",
    "ai": "npm:ai@^6",
    "zod": "npm:zod@^4",

    // Pick your provider(s):
    "@ai-sdk/anthropic": "npm:@ai-sdk/anthropic@^1",
    "@ai-sdk/openai": "npm:@ai-sdk/openai@^1",
    "@ai-sdk/google": "npm:@ai-sdk/google@^1"
  }
}
```

> **Why `ai` and a provider package?**
> Vibes is a thin layer over the [Vercel AI SDK](https://sdk.vercel.ai/). It doesn't bundle provider SDKs — you bring your own. This means you always get the latest provider features and can use any of the [50+ supported providers](https://sdk.vercel.ai/providers/ai-sdk-providers).

## Set Your API Key

Export your provider's API key as an environment variable:

```bash
# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...

# Google
export GOOGLE_GENERATIVE_AI_API_KEY=...
```

Or create a `.env` file and load it:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

```ts
// main.ts
import { load } from "@std/dotenv";
await load({ export: true });
```

## Verify the Install

Create `hello.ts`:

```ts
import { Agent } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run("Say exactly: hello from vibes");
console.log(result.output);
```

Run it:

```bash
deno run --allow-env --allow-net hello.ts
# hello from vibes
```

## Next Steps

- [Your First Agent](./first-agent.md) — build a real agent step by step
- [Adding Tools](./adding-tools.md) — give your agent capabilities
