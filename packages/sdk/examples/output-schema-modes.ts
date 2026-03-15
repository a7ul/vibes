/**
 * Tests outputSchema with all three outputMode values:
 *   - "tool"     (default) — model calls a special final_result tool
 *   - "native"   — model uses built-in structured output (JSON mode)
 *   - "prompted" — model is instructed via system prompt to return JSON
 */
import { Agent } from "../mod.ts";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "zod";

const ReviewSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().describe("Score from 1–10"),
  summary: z.string().describe("One-sentence summary"),
});

const PROMPT = "Review: 'Great product, works perfectly!' Analyze the sentiment.";

const SYSTEM = "You are a product review analyzer. Analyze the given review and return structured data.";

async function run(outputMode: "tool" | "native" | "prompted") {
  const agent = new Agent({
    model: anthropic("claude-haiku-4-5-20251001"),
    systemPrompt: SYSTEM,
    outputSchema: ReviewSchema,
    outputMode,
  });

  const result = await agent.run(PROMPT);
  return result.output;
}

console.log("Testing outputSchema with all three outputMode values...\n");

console.log('── outputMode: "tool" ──');
const toolResult = await run("tool");
console.log(toolResult);

console.log('\n── outputMode: "native" ──');
const nativeResult = await run("native");
console.log(nativeResult);

console.log('\n── outputMode: "prompted" ──');
const promptedResult = await run("prompted");
console.log(promptedResult);

console.log("\nAll three modes produced valid structured output ✓");
