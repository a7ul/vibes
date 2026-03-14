# Deferred Tools (Human-in-the-Loop)

Deferred tools pause an agent run when a tool call requires human approval
before execution. The caller inspects the pending requests, approves or modifies
them, then resumes the run.

## The Pattern

1. Mark a tool with `requiresApproval: true` (or a conditional function).
2. Call `agent.run()` inside a try/catch for `ApprovalRequiredError`.
3. Inspect `err.deferred.requests` — show them to the user.
4. Build a `DeferredToolResults` response.
5. Call `agent.resume(deferred, results)` to continue.

## Basic Usage

```ts
import { Agent, ApprovalRequiredError, tool } from "./mod.ts";
import { z } from "zod";

const deleteUser = tool({
  name: "delete_user",
  description: "Permanently delete a user account",
  parameters: z.object({ userId: z.string() }),
  requiresApproval: true, // always requires approval
  execute: async (_ctx, { userId }) => {
    await db.users.delete(userId);
    return `User ${userId} deleted.`;
  },
});

const agent = new Agent({ model, tools: [deleteUser] });

try {
  const result = await agent.run("Delete user u_123.");
  console.log(result.output);
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    const deferred = err.deferred;

    // Show pending tool calls to the user
    for (const req of deferred.requests) {
      console.log(`Approve "${req.toolName}" with args:`, req.args);
    }

    // Approve — inject a result directly without re-running the tool
    const results = {
      results: deferred.requests.map((req) => ({
        toolCallId: req.toolCallId,
        result: `Approved: user ${req.args.userId} deleted.`,
      })),
    };

    const finalResult = await agent.resume(deferred, results);
    console.log(finalResult.output);
  }
}
```

## Conditional Approval

Pass a function instead of `true` to require approval only under certain
conditions:

```ts
const transferFunds = tool({
  name: "transfer_funds",
  description: "Transfer money between accounts",
  parameters: z.object({ amount: z.number(), toAccount: z.string() }),
  requiresApproval: (_ctx, args) => args.amount > 1000, // only large transfers
  execute: async (_ctx, args) => doTransfer(args),
});
```

The function receives the `RunContext` and the proposed arguments. Return `true`
to pause, `false` to execute immediately.

## `DeferredToolRequest`

Each pending tool call in `deferred.requests` has:

| Field        | Type                      | Description                                        |
| ------------ | ------------------------- | -------------------------------------------------- |
| `toolCallId` | `string`                  | Correlates request to result — must be echoed back |
| `toolName`   | `string`                  | The name of the tool the model called              |
| `args`       | `Record<string, unknown>` | The arguments the model passed                     |

## `DeferredToolResult`

When calling `agent.resume()`, supply one result per request. Provide exactly
one of `result` or `argsOverride`:

| Field          | Type                      | Description                                   |
| -------------- | ------------------------- | --------------------------------------------- |
| `toolCallId`   | `string`                  | Must match a `DeferredToolRequest.toolCallId` |
| `result`       | `string \| object`        | Inject this value directly as the tool output |
| `argsOverride` | `Record<string, unknown>` | Re-execute the tool with these args instead   |

## Resuming with `argsOverride`

Use `argsOverride` to let a human correct the model's arguments before
execution:

```ts
const results = {
  results: [{
    toolCallId: deferred.requests[0].toolCallId,
    argsOverride: { userId: "u_456" }, // human corrected the ID
  }],
};

const finalResult = await agent.resume(deferred, results);
```

The tool's `execute` function is called with the overridden args, not the
original ones.

## Multiple Pending Approvals

A single turn can produce multiple tool calls. All of them must be resolved
before resuming:

```ts
const results = {
  results: deferred.requests.map((req) => {
    if (humanApproved(req)) {
      return { toolCallId: req.toolCallId, result: "approved" };
    } else {
      return { toolCallId: req.toolCallId, result: "rejected by user" };
    }
  }),
};

const finalResult = await agent.resume(deferred, results);
```

## Recipes

### UI Review Flow

Pause, serialize state, show UI, resume after response:

```ts
// Step 1: Start the run, catch approval error
let deferred: DeferredToolRequests | null = null;
try {
  await agent.run(prompt);
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    deferred = err.deferred;
    // Serialize and store deferred for the UI callback
    await store.set("pending", JSON.stringify(deferred.requests));
  }
}

// Step 2: UI posts back approved/rejected decisions
// Step 3: Resume
const deferred = loadFromStore();
const finalResult = await agent.resume(deferred, humanResults);
```

### `ApprovalRequiredToolset`

Use `ApprovalRequiredToolset` to wrap an entire toolset so all its tools require
approval:

```ts
import { ApprovalRequiredToolset } from "./mod.ts";

const safeToolset = new ApprovalRequiredToolset(dangerousToolset);
const agent = new Agent({ model, toolsets: [safeToolset] });
```

## API Reference

### `tool({ requiresApproval })`

| Value                                        | Behaviour                                  |
| -------------------------------------------- | ------------------------------------------ |
| `true`                                       | Always requires approval                   |
| `false` / omitted                            | Never requires approval                    |
| `(ctx, args) => boolean \| Promise<boolean>` | Conditional — called before each execution |

### `ApprovalRequiredError`

| Property   | Type                   | Description                                       |
| ---------- | ---------------------- | ------------------------------------------------- |
| `deferred` | `DeferredToolRequests` | Contains `requests` array and opaque resume state |
| `message`  | `string`               | Lists tool names requiring approval               |

### `agent.resume(deferred, results)`

| Arg        | Type                   | Description                                      |
| ---------- | ---------------------- | ------------------------------------------------ |
| `deferred` | `DeferredToolRequests` | The object from `ApprovalRequiredError.deferred` |
| `results`  | `DeferredToolResults`  | `{ results: DeferredToolResult[] }`              |

Returns `Promise<RunResult<TOutput>>` — same type as `agent.run()`.

## Error Behavior

- `ApprovalRequiredError` is thrown synchronously from `.run()` when the model
  produces a tool call with `requiresApproval: true`. The run is **paused**, not
  failed.
- Calling `agent.resume()` with missing `toolCallId` entries throws an error —
  every pending request must be resolved.
- If the resumed run itself triggers another approval-required tool,
  `agent.resume()` throws a new `ApprovalRequiredError`. Handle it the same way.
- After `maxTurns`, `MaxTurnsError` is thrown even inside a resumed run — turns
  are counted cumulatively.
