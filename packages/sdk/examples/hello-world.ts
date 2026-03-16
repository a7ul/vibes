import { Agent, tool } from "../mod.ts";
import { anthropic } from "npm:@ai-sdk/anthropic";
import { z } from "npm:zod";

const getCurrentTime = tool({
  name: "get_current_time",
  description: "Get the current date and time",
  parameters: z.object({}),
  execute:  (_ctx) => {
    return Promise.resolve(new Date().toISOString());
  },
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a helpful assistant.",
  tools: [getCurrentTime],
});

const result = await agent.run("What is the capital of France and what time is it?");
console.log(result.output);
