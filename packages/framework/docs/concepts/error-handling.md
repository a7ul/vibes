---
title: "Error Handling"
description: "All error types and recovery patterns"
---

# Error Handling

Vibes raises specific error types for different failure modes. Handling them explicitly makes agents more robust.

## Error Types

```ts
import {
  ApprovalRequiredError,
  MaxRetriesError,
  MaxTurnsError,
  ModelRequestsDisabledError,
  UsageLimitExceededError,
} from "@vibes/framework";
```

### `MaxTurnsError`

The agent hit `maxTurns` without producing a final answer.

```ts
import { MaxTurnsError } from "@vibes/framework";

try {
  const result = await agent.run(prompt);
} catch (err) {
  if (err instanceof MaxTurnsError) {
    console.error(`Agent ran out of turns after ${err.turns} turns`);
    // Consider: increasing maxTurns, simplifying the task, or
    // catching and returning a fallback response
  }
  throw err;
}
```

**Prevention:** Set `maxTurns` high enough for complex tasks. For tool-heavy agents, 20-50 is not unusual.

### `MaxRetriesError`

Structured output validation (or a result validator) failed after all retries.

```ts
import { MaxRetriesError } from "@vibes/framework";

try {
  const result = await agent.run(prompt);
} catch (err) {
  if (err instanceof MaxRetriesError) {
    console.error(`Validation failed after ${err.retries} retries`);
    console.error("Last error:", err.lastError.message);
  }
  throw err;
}
```

**Prevention:**
- Keep Zod schemas simple — deeply nested required fields fail more often
- Use `.describe()` on fields to guide the model
- Make fields optional where possible
- Check your result validators aren't too strict

### `ApprovalRequiredError`

One or more tools require human approval before execution. This is thrown intentionally — it's not a failure.

```ts
import { ApprovalRequiredError } from "@vibes/framework";

try {
  const result = await agent.run(prompt);
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    const deferred = err.deferred;

    // Show the pending tool calls to the user
    for (const request of deferred.requests) {
      console.log(`Approve tool: ${request.toolName}`);
      console.log(`Arguments: ${JSON.stringify(request.args)}`);
    }

    // After user approves:
    const result = await agent.resume(deferred, {
      results: deferred.requests.map((r) => ({
        toolCallId: r.toolCallId,
        result: "approved",
      })),
    });
  }
}
```

See [Deferred Tools](../reference/advanced/deferred-tools) for the full pattern.

### `UsageLimitExceededError`

The run exceeded a token or request budget set via `usageLimits`.

```ts
import { UsageLimitExceededError } from "@vibes/framework";

try {
  const result = await agent.run(prompt, {
    usageLimits: {
      totalTokens: 10_000,
      requests: 5,
    },
  });
} catch (err) {
  if (err instanceof UsageLimitExceededError) {
    console.error(`Usage exceeded: ${err.message}`);
    console.error(`Usage at failure: ${JSON.stringify(err.usage)}`);
  }
}
```

### `ModelRequestsDisabledError`

Thrown by `setAllowModelRequests(false)` when a non-mocked agent tries to call the model. Only relevant in tests.

```ts
import { setAllowModelRequests, ModelRequestsDisabledError } from "@vibes/framework";

setAllowModelRequests(false);  // call in test files

// This will throw ModelRequestsDisabledError if model is not mocked
const result = await agent.run(prompt);  // throws!
```

## Complete Error Handler Pattern

```ts
import {
  ApprovalRequiredError,
  MaxRetriesError,
  MaxTurnsError,
  UsageLimitExceededError,
} from "@vibes/framework";

async function runAgent(prompt: string) {
  try {
    return await agent.run(prompt);
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      // Not a failure — needs human input
      return { status: "pending_approval", deferred: err.deferred };
    }

    if (err instanceof MaxTurnsError) {
      // Agent got stuck — log and return graceful error
      logger.warn("Agent exceeded max turns", { turns: err.turns, prompt });
      return { status: "error", message: "Request too complex. Please simplify." };
    }

    if (err instanceof MaxRetriesError) {
      // Output validation failed — usually a model or schema issue
      logger.error("Output validation failed", { error: err.lastError });
      return { status: "error", message: "Unable to produce valid response." };
    }

    if (err instanceof UsageLimitExceededError) {
      // Budget exceeded — return partial result or error
      logger.warn("Usage limit exceeded", { usage: err.usage });
      return { status: "error", message: "Request too expensive." };
    }

    // Unknown error — re-throw for caller to handle
    throw err;
  }
}
```

## Tool Errors

Tool errors bubble up and are sent back to the model as error results. The model can respond to the error and try a different approach.

```ts
const searchTool = tool({
  name: "search",
  execute: async (_ctx, { query }) => {
    const response = await fetch(`https://api.search.com?q=${query}`);
    if (!response.ok) {
      // This error is sent to the model — it can retry or use a different tool
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  },
  maxRetries: 2,  // auto-retry the tool before sending error to model
});
```

If a tool exhausts its `maxRetries`, the error is propagated to the model as a tool result, which can decide how to proceed.

## Provider Errors

Network failures, rate limits, and API errors from the LLM provider are not wrapped by Vibes — they propagate as-is from the Vercel AI SDK. Handle them in your calling code:

```ts
import { APICallError } from "ai";

try {
  const result = await agent.run(prompt);
} catch (err) {
  if (err instanceof APICallError) {
    if (err.statusCode === 429) {
      // Rate limited — back off and retry
      await sleep(5000);
      return await agent.run(prompt);
    }
  }
  throw err;
}
```

## Next Steps

- [Errors reference](../reference/core/errors) — complete API reference for all error types
- [Usage Limits](../reference/advanced/usage-limits) — control costs with token and request budgets
- [Deferred Tools](../reference/advanced/deferred-tools) — human-in-the-loop approval patterns
