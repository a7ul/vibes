import { Agent, CombinedToolset } from "@vibesjs/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { bashToolset } from "./toolsets/bash.ts";
import { filesToolset } from "./toolsets/files.ts";
import { tasksToolset } from "./toolsets/tasks.ts";
import { SKILL } from "./skill.ts";
import { MAX_RETRIES, MAX_TURNS, MODEL } from "../../constants.ts";
import { CoreAgentOutputSchema } from "../../types.ts";
import type { CoreAgentDeps, CoreAgentOutput } from "../../types.ts";

export function createCoreAgent(): Agent<CoreAgentDeps, CoreAgentOutput> {
  return new Agent<CoreAgentDeps, CoreAgentOutput>({
    name: "core-agent",
    model: anthropic(MODEL),
    systemPrompt: SKILL,
    toolsets: [new CombinedToolset(bashToolset, filesToolset, tasksToolset)],
    outputSchema: CoreAgentOutputSchema,
    maxTurns: MAX_TURNS,
    maxRetries: MAX_RETRIES,
  });
}
