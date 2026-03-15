import { Agent, ApprovalRequiredError, tool } from "../mod.ts";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "zod";

const sendEmail = tool({
  name: "send_email",
  description: "Send an email to a recipient",
  parameters: z.object({
    to: z.string().email().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content"),
  }),
  execute: async (_ctx, { to, subject }) => {
    console.log(`[EMAIL SENT] To: ${to}, Subject: "${subject}"`);
    return "Email sent successfully.";
  },
  requiresApproval: true,
});

const agent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are an email assistant. Send emails when asked.",
  tools: [sendEmail],
});

async function requestApproval(toolName: string, args: unknown): Promise<boolean> {
  console.log(`\n--- Approval Required ---`);
  console.log(`Tool: ${toolName}`);
  console.log(`Args:`, JSON.stringify(args, null, 2));
  console.log(`Decision: APPROVED`);
  return true;
}

try {
  await agent.run("Send a welcome email to alice@example.com");
} catch (err) {
  if (err instanceof ApprovalRequiredError) {
    const { deferred } = err;

    const toolResults: Array<{ toolCallId: string; result: string }> = [];

    for (const req of deferred.requests) {
      const approved = await requestApproval(req.toolName, req.args);
      toolResults.push({
        toolCallId: req.toolCallId,
        result: approved ? "approved" : "rejected",
      });
    }

    const finalResult = await agent.resume(deferred, { results: toolResults });
    console.log("\nFinal response:", finalResult.output);
  } else {
    throw err;
  }
}
