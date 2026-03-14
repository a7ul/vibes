/**
 * Tests for deferred tools / human-in-the-loop approval pattern.
 *
 * Tests `requiresApproval` on ToolDefinition, `ApprovalRequiredError`,
 * `DeferredToolRequests`, and `agent.resume()`.
 */
import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";
import {
  Agent,
  ApprovalRequiredError,
  DeferredToolRequests,
  type DeferredToolResults,
  tool,
} from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Basic approval required - static boolean
// ---------------------------------------------------------------------------

Deno.test("requiresApproval: true - agent.run() throws ApprovalRequiredError", async () => {
  const sensitiveOp = tool({
    name: "delete_user",
    description: "Delete a user account",
    parameters: z.object({ userId: z.string() }),
    execute: (_ctx, args) => Promise.resolve(`Deleted user ${args.userId}`),
    requiresApproval: true,
  });

  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(
        toolCallResponse("delete_user", { userId: "u123" }, "tc-del"),
      ),
  });

  const agent = new Agent({ model, tools: [sensitiveOp] });

  await assertRejects(
    () => agent.run("Delete user u123"),
    ApprovalRequiredError,
    "Approval required",
  );
});

Deno.test("ApprovalRequiredError contains correct deferred request info", async () => {
  const sensitiveOp = tool({
    name: "send_email",
    description: "Send an email",
    parameters: z.object({ to: z.string(), body: z.string() }),
    execute: () => Promise.resolve("Email sent"),
    requiresApproval: true,
  });

  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(
        toolCallResponse("send_email", {
          to: "user@example.com",
          body: "Hello",
        }, "tc-email"),
      ),
  });

  const agent = new Agent({ model, tools: [sensitiveOp] });

  let caughtError: ApprovalRequiredError | null = null;
  try {
    await agent.run("Send a hello email");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      caughtError = err;
    }
  }

  assertInstanceOf(caughtError, ApprovalRequiredError);
  assertEquals(caughtError!.deferred.requests.length, 1);
  assertEquals(caughtError!.deferred.requests[0].toolName, "send_email");
  assertEquals(caughtError!.deferred.requests[0].args, {
    to: "user@example.com",
    body: "Hello",
  });
});

// ---------------------------------------------------------------------------
// Dynamic approval predicate
// ---------------------------------------------------------------------------

Deno.test("requiresApproval function: returns false - tool executes normally", async () => {
  let toolExecuted = false;
  const conditionalTool = tool<{ isAdmin: boolean }>({
    name: "admin_action",
    description: "Perform admin action",
    parameters: z.object({ action: z.string() }),
    execute: (_ctx, args) => {
      toolExecuted = true;
      const a = args as { action: string };
      return Promise.resolve(`Done: ${a.action}`);
    },
    // Admin users don't need approval
    requiresApproval: (ctx) => !ctx.deps.isAdmin,
  });

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("admin_action", { action: "reset" }),
    textResponse("Action completed"),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent<{ isAdmin: boolean }>({
    model,
    tools: [conditionalTool],
  });
  const result = await agent.run("Do admin action", {
    deps: { isAdmin: true },
  });

  assertEquals(toolExecuted, true);
  assertEquals(result.output, "Action completed");
});

Deno.test("requiresApproval function: returns true - throws ApprovalRequiredError", async () => {
  const conditionalTool = tool<{ isAdmin: boolean }>({
    name: "admin_action",
    description: "Perform admin action",
    parameters: z.object({ action: z.string() }),
    execute: (_ctx, args) => {
      const a = args as { action: string };
      return Promise.resolve(`Done: ${a.action}`);
    },
    requiresApproval: (ctx) => !ctx.deps.isAdmin,
  });

  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(toolCallResponse("admin_action", { action: "reset" })),
  });

  const agent = new Agent<{ isAdmin: boolean }>({
    model,
    tools: [conditionalTool],
  });

  await assertRejects(
    () => agent.run("Do admin action", { deps: { isAdmin: false } }),
    ApprovalRequiredError,
  );
});

// ---------------------------------------------------------------------------
// Resume after approval
// ---------------------------------------------------------------------------

Deno.test("agent.resume() - injects approved result and completes run", async () => {
  const sensitiveOp = tool({
    name: "charge_card",
    description: "Charge a credit card",
    parameters: z.object({ amount: z.number() }),
    execute: (_ctx, args) => Promise.resolve(`Charged $${args.amount}`),
    requiresApproval: true,
  });

  const firstCallResponses = mockValues<DoGenerateResult>(
    toolCallResponse("charge_card", { amount: 99 }, "tc-charge"),
  );
  const resumeCallResponses = mockValues<DoGenerateResult>(
    textResponse("Payment processed successfully"),
  );

  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      if (callCount === 1) return Promise.resolve(firstCallResponses());
      return Promise.resolve(resumeCallResponses());
    },
  });

  const agent = new Agent({ model, tools: [sensitiveOp] });

  // First run: should throw ApprovalRequiredError
  let deferredErr: ApprovalRequiredError | null = null;
  try {
    await agent.run("Charge $99");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      deferredErr = err;
    } else {
      throw err;
    }
  }

  assertInstanceOf(deferredErr, ApprovalRequiredError);
  assertEquals(deferredErr!.deferred.requests[0].toolName, "charge_card");

  // Human approves with an injected result
  const approvedResults: DeferredToolResults = {
    results: [
      {
        toolCallId: deferredErr!.deferred.requests[0].toolCallId,
        result: "Charged $99 - approved by admin",
      },
    ],
  };

  // Resume the run with approved results
  const finalResult = await agent.resume(
    deferredErr!.deferred,
    approvedResults,
  );
  assertEquals(finalResult.output, "Payment processed successfully");
  assertEquals(callCount, 2);
});

Deno.test("agent.resume() - DeferredToolRequests stores correct resume state", async () => {
  const sensitiveOp = tool({
    name: "wipe_database",
    description: "Wipe the database",
    parameters: z.object({ confirm: z.boolean() }),
    execute: () => Promise.resolve("Database wiped"),
    requiresApproval: true,
  });

  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(toolCallResponse("wipe_database", { confirm: true })),
  });

  const agent = new Agent({ model, tools: [sensitiveOp] });

  let deferred: import("../mod.ts").DeferredToolRequests | null = null;
  try {
    await agent.run("Wipe the database");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      deferred = err.deferred;
    }
  }

  assertInstanceOf(deferred, DeferredToolRequests);
  // Resume state should contain the message history
  assertEquals(Array.isArray(deferred!._resumeState.messages), true);
  // Should have at least the user message and the assistant's tool call
  assertEquals(deferred!._resumeState.messages.length >= 2, true);
  assertEquals(deferred!._resumeState.turnCount, 1);
});

// ---------------------------------------------------------------------------
// Normal tool runs alongside approval-required tool
// ---------------------------------------------------------------------------

Deno.test("normal tools execute; approval-required tool throws", async () => {
  let normalToolCalled = false;
  const normalTool = tool({
    name: "log_action",
    description: "Log an action",
    parameters: z.object({ msg: z.string() }),
    execute: (_ctx, args) => {
      normalToolCalled = true;
      return Promise.resolve(`Logged: ${args.msg}`);
    },
  });

  const approvalTool = tool({
    name: "deploy_prod",
    description: "Deploy to production",
    parameters: z.object({ version: z.string() }),
    execute: () => Promise.resolve("Deployed"),
    requiresApproval: true,
  });

  // Model calls the approval-required tool only
  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(toolCallResponse("deploy_prod", { version: "v2.0" })),
  });

  const agent = new Agent({ model, tools: [normalTool, approvalTool] });

  await assertRejects(
    () => agent.run("Deploy v2.0"),
    ApprovalRequiredError,
  );

  // Normal tool was NOT called since the model called the approval tool
  assertEquals(normalToolCalled, false);
});

// ---------------------------------------------------------------------------
// argsOverride in resume
// ---------------------------------------------------------------------------

Deno.test("DeferredToolResult.argsOverride - re-executes tool with modified args", async () => {
  const executedArgs: { amount?: number }[] = [];
  const chargeOp = tool({
    name: "charge",
    description: "Charge amount",
    parameters: z.object({ amount: z.number() }),
    execute: (_ctx, args) => {
      executedArgs.push({ amount: args.amount });
      return Promise.resolve(`Charged $${args.amount}`);
    },
    requiresApproval: true,
  });

  const firstCall = mockValues<DoGenerateResult>(
    toolCallResponse("charge", { amount: 1000 }, "tc-charge"),
  );
  const resumeCall = mockValues<DoGenerateResult>(
    textResponse("All done"),
  );
  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? firstCall() : resumeCall());
    },
  });

  const agent = new Agent({ model, tools: [chargeOp] });

  let deferredErr: ApprovalRequiredError | null = null;
  try {
    await agent.run("Charge $1000");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) deferredErr = err;
    else throw err;
  }

  assertInstanceOf(deferredErr, ApprovalRequiredError);

  // Human approves but changes the amount to $50
  const approvedResults: DeferredToolResults = {
    results: [
      {
        toolCallId: deferredErr!.deferred.requests[0].toolCallId,
        argsOverride: { amount: 50 },
      },
    ],
  };

  const finalResult = await agent.resume(
    deferredErr!.deferred,
    approvedResults,
  );
  assertEquals(finalResult.output, "All done");

  // Tool was re-executed with the overridden amount
  assertEquals(executedArgs.length, 1);
  assertEquals(executedArgs[0].amount, 50);
});
