# Human-in-the-Loop

Vibes supports pausing an agent run to get human approval before executing sensitive tools. The run is suspended, your code shows the pending actions to a user, and then the run resumes with the user's decision.

> **Coming from pydantic-ai?** This maps to pydantic-ai's `allow_model_requests=False` and `run_context` patterns for human approval, but as a first-class feature with `requiresApproval` on tools and `agent.resume()`.

## Mark a Tool as Requiring Approval

```ts
import { tool } from "@vibes/framework";
import { z } from "zod";

const sendEmail = tool({
  name: "send_email",
  description: "Send an email to a user",
  parameters: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  requiresApproval: true,  // always require approval
  execute: async (_ctx, { to, subject, body }) => {
    await emailService.send({ to, subject, body });
    return `Email sent to ${to}`;
  },
});
```

## Handle the Approval Flow

```ts
import { ApprovalRequiredError } from "@vibes/framework";

try {
  const result = await agent.run("Send a welcome email to alice@example.com");
  console.log(result.output);
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    const deferred = err.deferred;

    // Show the pending calls to the user
    for (const request of deferred.requests) {
      console.log(`\nTool: ${request.toolName}`);
      console.log(`Args: ${JSON.stringify(request.args, null, 2)}`);
    }

    const userApproved = await promptUser("Approve these actions? (y/n): ");

    if (userApproved) {
      // Resume with approval — tools will execute
      const result = await agent.resume(deferred, {
        results: deferred.requests.map((r) => ({
          toolCallId: r.toolCallId,
          result: "approved by user",
        })),
      });
      console.log(result.output);
    } else {
      console.log("Actions cancelled by user.");
    }
  }
}
```

## Resume Options

When resuming, you have three choices per tool call:

### 1. Pass a result directly (skip execution)

```ts
results: [{
  toolCallId: "tc1",
  result: "Manually approved: email sent at 14:30",
  // execute() is NOT called — this string becomes the tool result
}]
```

### 2. Re-execute with original args

```ts
results: [{
  toolCallId: "tc1",
  // No result, no argsOverride — execute() runs with original args
}]
```

### 3. Re-execute with modified args

```ts
results: [{
  toolCallId: "tc1",
  argsOverride: {
    to: "alice@example.com",
    subject: "Welcome!",
    body: "Hi Alice, welcome to our platform.",  // user edited the body
  },
  // execute() runs with these args instead of the model's original args
}]
```

## Conditional Approval

Only require approval in production, not in development:

```ts
const deleteRecords = tool({
  name: "delete_records",
  description: "Delete records matching a filter",
  parameters: z.object({ filter: z.string() }),
  requiresApproval: Deno.env.get("NODE_ENV") === "production",
  execute: async (_ctx, { filter }) => {
    return await db.records.deleteWhere(filter);
  },
});
```

Or use the `ApprovalRequiredToolset` to wrap an entire toolset:

```ts
import { ApprovalRequiredToolset } from "@vibes/framework";

const agent = new Agent({
  model,
  toolsets: [
    new ApprovalRequiredToolset(dangerousToolset),
  ],
});
```

## Multiple Pending Tools

If the model calls multiple approval-required tools in one turn, all are suspended together:

```ts
// The model called both send_email and update_database in the same turn
catch (err) {
  if (err instanceof ApprovalRequiredError) {
    const { requests } = err.deferred;

    // requests has both tool calls
    console.log(`${requests.length} tools pending approval:`);
    requests.forEach((r) => console.log(`  - ${r.toolName}`));

    // Approve some, reject others
    const approved = requests.filter((r) => r.toolName === "send_email");
    const rejected = requests.filter((r) => r.toolName === "update_database");

    const results = [
      ...approved.map((r) => ({ toolCallId: r.toolCallId })),  // execute
      ...rejected.map((r) => ({
        toolCallId: r.toolCallId,
        result: "Action rejected by user.",  // inject rejection message
      })),
    ];

    const result = await agent.resume(err.deferred, { results });
  }
}
```

## Web Application Pattern

In a web app, you need to serialize the `DeferredToolRequests` between requests:

```ts
// Route: POST /chat
async function chat(req: Request) {
  const { prompt, sessionId, deferredState } = await req.json();

  try {
    if (deferredState) {
      // Resuming a paused run
      const deferred = DeferredToolRequests.fromState(deferredState);
      const result = await agent.resume(deferred, {
        results: [{ toolCallId: deferredState.pendingId, result: "approved" }],
      });
      return Response.json({ output: result.output });
    }

    // Fresh run
    const result = await agent.run(prompt);
    return Response.json({ output: result.output });

  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      // Serialize the deferred state to send to the client
      return Response.json({
        status: "pending_approval",
        requests: err.deferred.requests,
        // Store _resumeState server-side (in DB/session), keyed by a token
        approvalToken: await saveResumeState(sessionId, err.deferred._resumeState),
      });
    }
    throw err;
  }
}
```

## Next Steps

- [Deferred Tools reference](../deferred-tools.md) — full API reference
- [Error Handling](../concepts/error-handling.md) — `ApprovalRequiredError` details
