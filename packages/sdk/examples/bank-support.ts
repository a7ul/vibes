import { Agent, tool } from "../mod.ts";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "zod";

class DatabaseConn {
  customerName(id: number): Promise<string> {
    const names: Record<number, string> = { 123: "Alice", 456: "Bob" };
    return Promise.resolve(names[id] ?? "Unknown");
  }

  customerBalance(id: number): Promise<number> {
    const balances: Record<number, number> = { 123: 1250.50, 456: 89.0 };
    return Promise.resolve(balances[id] ?? 0);
  }
}

type Deps = { customerId: number; db: DatabaseConn };

const SupportOutput = z.object({
  supportAdvice: z.string().describe("Advice to give the customer"),
  blockCard: z.boolean().describe("Whether to block the customer's card"),
  risk: z.number().int().min(0).max(10).describe("Risk level 0-10"),
});

const supportAgent = new Agent<Deps, z.infer<typeof SupportOutput>>({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt:
    "You are a support agent in our bank. Give the customer support and " +
    "judge the risk level of their query. Reply using the customer's name.",
  instructions: async (ctx) => {
    const name = await ctx.deps.db.customerName(ctx.deps.customerId);
    return `The customer's name is ${name}.`;
  },
  tools: [
    tool<Deps>({
      name: "customer_balance",
      description: "Returns the customer's current account balance",
      parameters: z.object({}),
      execute: async (ctx) => {
        const balance = await ctx.deps.db.customerBalance(ctx.deps.customerId);
        return `$${balance.toFixed(2)}`;
      },
    }),
  ],
  outputSchema: SupportOutput,
});

const db = new DatabaseConn();

const result = await supportAgent.run("What is my balance?", {
  deps: { customerId: 123, db },
});

console.log(result.output);
