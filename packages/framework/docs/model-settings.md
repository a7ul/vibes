# Model Settings

Model settings control generation parameters — temperature, token limits, stop
sequences — passed to the underlying model API on every request.

## Basic Usage

Pass `modelSettings` at agent construction time to apply defaults to every run:

```ts
import { Agent } from "./mod.ts";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a creative writer.",
  modelSettings: {
    temperature: 0.9,
    maxTokens: 2048,
  },
});
```

Override per-run by passing `modelSettings` to `.run()` or `.stream()`:

```ts
// Use lower temperature for this specific run
const result = await agent.run("Summarise this report.", {
  modelSettings: { temperature: 0.1 },
});
```

Per-run settings are merged with agent-level settings. Per-run values take
precedence over agent-level values for any fields they specify.

## `ModelSettings` Interface

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `temperature` | `number` | model default | Sampling temperature (0–2). Higher = more creative/random |
| `maxTokens` | `number` | model default | Maximum output tokens per model request |
| `topP` | `number` | model default | Nucleus sampling threshold (0–1) |
| `topK` | `number` | model default | Top-K sampling (model-dependent) |
| `presencePenalty` | `number` | model default | Penalise tokens already present in context |
| `frequencyPenalty` | `number` | model default | Penalise frequently used tokens |
| `stopSequences` | `string[]` | — | Stop generation at these sequences |
| `seed` | `number` | — | Seed for deterministic generation (model-dependent) |

All fields are optional. Omit any field to use the model's default.

## Recipes

### Deterministic Testing

Use a fixed `seed` and `temperature: 0` for reproducible outputs in tests:

```ts
const agent = new Agent({
  model,
  modelSettings: { temperature: 0, seed: 42 },
});
```

### Creative vs Precise

Configure two agent instances from the same model for different tasks:

```ts
const creativeAgent = new Agent({
  model,
  modelSettings: { temperature: 1.2, topP: 0.95 },
});

const preciseAgent = new Agent({
  model,
  modelSettings: { temperature: 0, maxTokens: 512 },
});
```

### Stop at Sentinel

Prevent runaway generation in structured prompting:

```ts
const agent = new Agent({
  model,
  modelSettings: {
    stopSequences: ["</answer>", "END"],
  },
});
```

### Per-Run Override

Apply task-specific settings without changing the agent default:

```ts
const result = await agent.run(longDocumentPrompt, {
  modelSettings: {
    maxTokens: 4096,
    temperature: 0.2,
  },
});
```

## Model-Specific Notes

- `topK` is supported by Anthropic models but not all OpenAI models. Unsupported
  fields are silently ignored by the Vercel AI SDK.
- `seed` support varies by provider. Check provider docs for determinism
  guarantees.
- `temperature` and `topP` interact — many providers recommend setting only one.

## Error Behavior

- Invalid values (e.g. `temperature: 3`) may cause the model API to return a
  `400 Bad Request`. The error surfaces as a thrown exception from `.run()` or
  when awaiting `.stream()` promises.
- Unsupported settings for a given model/provider are typically ignored silently
  by the Vercel AI SDK.
