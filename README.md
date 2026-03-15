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

See [`packages/sdk`](./packages/sdk) for full documentation, examples, and API reference.

## License

MIT
