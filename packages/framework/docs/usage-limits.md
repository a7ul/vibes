# Usage Limits

Usage limits let you cap how many tokens or model requests an agent can consume
in a single run, throwing a `UsageLimitError` if the budget is exceeded.

## Basic Usage

Pass a `usageLimits` object when calling `.run()` or `.stream()`:

```ts
import { Agent } from "./mod.ts";

const agent = new Agent({
  model,
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run("Summarise this document.", {
  usageLimits: {
    maxTotalTokens: 5000,
  },
});
```

Or set limits at the agent level so they apply to every run:

```ts
const agent = new Agent({
  model,
  usageLimits: {
    maxRequests: 10,
    maxTotalTokens: 50_000,
  },
});
```

Per-run limits override agent-level limits.

## `UsageLimits` Interface

| Option            | Type     | Default | Description                              |
| ----------------- | -------- | ------- | ---------------------------------------- |
| `maxRequests`     | `number` | —       | Max number of model requests (turns)     |
| `maxInputTokens`  | `number` | —       | Max input tokens consumed cumulatively   |
| `maxOutputTokens` | `number` | —       | Max output tokens generated cumulatively |
| `maxTotalTokens`  | `number` | —       | Max combined input + output tokens       |

All fields are optional. Omit any field to leave that dimension uncapped.

## `UsageLimitError`

Thrown before any model request that would exceed the configured limit.

```ts
import { UsageLimitError } from "./mod.ts";

try {
  await agent.run("Do a lot of work.", { usageLimits: { maxRequests: 3 } });
} catch (err) {
  if (err instanceof UsageLimitError) {
    console.error(`Limit exceeded: ${err.limitKind}`);
    console.error(`Current: ${err.current}, limit: ${err.limit}`);
  }
}
```

| Property    | Type                                                             | Description                                   |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `limitKind` | `"requests" \| "inputTokens" \| "outputTokens" \| "totalTokens"` | Which limit was hit                           |
| `current`   | `number`                                                         | The cumulative value at the time of the error |
| `limit`     | `number`                                                         | The configured cap                            |
| `message`   | `string`                                                         | Human-readable description                    |

## Recipes

### Budget guard for user-facing APIs

Prevent runaway costs from adversarial prompts:

```ts
const result = await agent.run(userPrompt, {
  deps: { userId },
  usageLimits: {
    maxRequests: 5,
    maxTotalTokens: 10_000,
  },
});
```

### Soft limit with fallback

Catch the limit error and return a graceful response instead of surfacing an
exception to the user:

```ts
try {
  return await agent.run(prompt, { usageLimits: { maxTotalTokens: 8000 } });
} catch (err) {
  if (err instanceof UsageLimitError) {
    return {
      output:
        "I ran out of budget for this request. Please try a shorter prompt.",
    };
  }
  throw err;
}
```

### Monitoring usage

Read `result.usage` after a successful run to track consumption:

```ts
const result = await agent.run("...");
console.log(result.usage.requests); // number of LLM calls
console.log(result.usage.inputTokens); // total input tokens
console.log(result.usage.outputTokens); // total output tokens
console.log(result.usage.totalTokens); // inputTokens + outputTokens
```

## Error Behavior

- Limits are checked **before** each model request, not after. A run that ends
  exactly on a limit boundary succeeds.
- `UsageLimitError` is a terminal error — the run is not retried. Catch it
  explicitly if you need a fallback.
- For streaming, the error surfaces when you await `stream.output`,
  `stream.messages`, or `stream.usage`.
