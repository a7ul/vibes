---
title: "Errors"
description: "All error types thrown by @vibes/framework"
---

# Errors

The framework throws two custom error types. Both extend `Error` and can be
caught with `instanceof`.

## `MaxTurnsError`

Thrown when a run exceeds `maxTurns` (default: `10`) without producing a final
result. This usually means the model is looping — calling tools repeatedly
without converging on an answer.

```ts
import { MaxTurnsError } from "@vibes/framework";

try {
  const result = await agent.run("Do something complex.");
} catch (err) {
  if (err instanceof MaxTurnsError) {
    console.error("Agent exceeded the turn limit:", err.message);
    // "Agent exceeded maxTurns (10)"
  }
}
```

**Constructor:** `new MaxTurnsError(turns: number)`

**Increase the limit** if your task genuinely needs more tool calls:

```ts
const agent = new Agent({ model: ..., maxTurns: 20 });
```

---

## `MaxRetriesError`

Thrown when result validation fails more times than `maxRetries` allows
(default: `3`). Occurs when:

- A `resultValidator` throws on every attempt.
- The model calls `final_result` with data that fails Zod validation on every
  attempt.
- The model repeatedly produces plain text instead of calling `final_result`
  when `outputSchema` is set.

```ts
import { MaxRetriesError } from "@vibes/framework";

try {
  const result = await agent.run("Give me a structured answer.");
} catch (err) {
  if (err instanceof MaxRetriesError) {
    console.error("Validation failed too many times:", err.message);
    // "Result validation failed after 3 retries: Score must be between 1 and 10"
    console.error("Underlying cause:", err.cause);
  }
}
```

**Constructor:** `new MaxRetriesError(retries: number, cause?: Error)`

- `err.message` — includes the retry count and the last validation error
  message.
- `err.cause` — the last `Error` thrown by a result validator (if any).

**Increase the limit** if your schema or validators are strict and the model
needs more attempts:

```ts
const agent = new Agent({ model: ..., maxRetries: 5 });
```

---

## Model / Provider Errors

Errors from the underlying AI SDK (network failures, API errors, rate limits)
propagate directly — they are not wrapped. Catch them the same way:

```ts
import { APICallError } from "ai";

try {
  const result = await agent.run("Hello.");
} catch (err) {
  if (err instanceof APICallError) {
    console.error("API call failed:", err.statusCode, err.message);
  }
}
```

---

## Error Handling Pattern

```ts
import { MaxRetriesError, MaxTurnsError } from "@vibes/framework";

async function safeRun(agent: Agent, prompt: string) {
  try {
    return await agent.run(prompt);
  } catch (err) {
    if (err instanceof MaxTurnsError) {
      // Agent looped — simplify the prompt or increase maxTurns
      throw new Error(
        "Agent could not complete the task within the turn limit",
      );
    }
    if (err instanceof MaxRetriesError) {
      // Output never passed validation — relax validators or improve the prompt
      throw new Error(`Validation failed: ${err.cause?.message}`);
    }
    // Rethrow unexpected errors (network, auth, etc.)
    throw err;
  }
}
```
