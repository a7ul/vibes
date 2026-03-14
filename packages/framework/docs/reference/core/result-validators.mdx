---
title: "Result Validators"
description: "Post-process and retry agent output"
---

Result validators run after the model's output has been parsed by Zod. They let
you enforce business rules, transform the output, or reject it and force the
model to try again.

## Basic Usage

A validator is a function that receives the [`RunContext`](../core/run-context) and
the parsed output. Return the output to accept it (optionally modified), or
throw an `Error` to reject it.

```ts
import { Agent } from "@vibes/framework";
import { z } from "zod";

const ScoreSchema = z.object({ score: z.number() });
type Score = z.infer<typeof ScoreSchema>;

const agent = new Agent<undefined, Score>({
  model: ...,
  outputSchema: ScoreSchema,
  resultValidators: [
    (_ctx, output) => {
      if (output.score < 1 || output.score > 10) {
        throw new Error("Score must be between 1 and 10");
      }
      return output;
    },
  ],
});
```

## `ResultValidator<TDeps, TOutput>`

```ts
type ResultValidator<TDeps, TOutput> = (
  ctx: RunContext<TDeps>,
  output: TOutput,
) => TOutput | Promise<TOutput>;
```

| Parameter  | Description                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `ctx`      | The current [`RunContext`](../core/run-context), including `deps`, `usage`, `retryCount`, and `runId` |
| `output`   | The Zod-parsed output from the model                                                               |
| **Return** | The accepted output (same or modified). Throw to reject.                                           |

## Retry Behaviour

When a validator throws, the error message is sent back to the model as a user
message asking it to try again. The run retries up to `maxRetries` (default:
`3`). If all retries are exhausted, [`MaxRetriesError`](../core/errors) is thrown.

```ts
const agent = new Agent<undefined, Output>({
  model: ...,
  outputSchema: MySchema,
  maxRetries: 5,
  resultValidators: [strictValidator],
});
```

`ctx.retryCount` increments each time a retry occurs, so validators can inspect
how many attempts have already been made:

```ts
((_ctx, output) => {
  if (ctx.retryCount >= 2) {
    // Relax constraints on later retries
    return output;
  }
  if (!meetsStrictCriteria(output)) {
    throw new Error("Output does not meet strict criteria");
  }
  return output;
});
```

## Transforming Output

Validators can return a modified version of the output. The modified value
becomes `result.output`:

```ts
resultValidators: [
  (_ctx, output) => ({
    ...output,
    name: output.name.trim(),
    tags: output.tags.map(t => t.toLowerCase()),
  }),
],
```

## Async Validators

Validators can be `async`, useful for database lookups or external API calls:

```ts
resultValidators: [
  async (ctx, output) => {
    const exists = await ctx.deps.db.users.exists(output.userId);
    if (!exists) throw new Error(`User ${output.userId} not found`);
    return output;
  },
],
```

## Multiple Validators

Multiple validators run in order. Each receives the output returned by the
previous validator:

```ts
resultValidators: [
  normaliseOutput,   // runs first, returns cleaned output
  validateSchema,    // receives cleaned output
  checkPermissions,  // receives validated output
],
```

If any validator throws, the entire output is rejected and the model retries.

## Validators Without Dependencies

If your agent has `TDeps = undefined`, the `ctx` argument is still present but
`ctx.deps` is `undefined`:

```ts
resultValidators: [
  (_ctx: RunContext<undefined>, output: MyOutput) => {
    if (!output.id) throw new Error("id is required");
    return output;
  },
],
```

## Adding Validators After Construction

```ts
agent.addResultValidator(async (ctx, output) => {
  // additional check
  return output;
});
```
