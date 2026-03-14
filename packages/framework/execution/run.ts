import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { RunContext } from "../types/run_context.ts";
import type { RunResult } from "../types/result.ts";
import {
  applyUsage,
  buildInitialMessages,
  buildToolMap,
  createRunContext,
  FINAL_RESULT_TOOL,
  nudgeForFinalResult,
  nudgeWithValidationError,
  resolveSystemPrompt,
  runValidators,
  toolsOrUndefined,
} from "./_run_utils.ts";
import { MaxTurnsError } from "../errors.ts";

export { MaxTurnsError, MaxRetriesError } from "../errors.ts";

export async function executeRun<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  prompt: string,
  opts: { deps: TDeps; messageHistory?: ModelMessage[] },
): Promise<RunResult<TOutput>> {
  const ctx: RunContext<TDeps> = createRunContext(opts.deps);
  const { usage, runId } = ctx;

  const systemPrompt = await resolveSystemPrompt(agent as Agent<TDeps, unknown>, ctx);
  const messages = buildInitialMessages(opts.messageHistory, prompt);
  const toolMap = buildToolMap(agent as Agent<TDeps, unknown>, ctx);
  const tools = toolsOrUndefined(toolMap);

  for (let turn = 0; turn < agent.maxTurns; turn++) {
    const response = await generateText({
      model: agent.model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(1),
    });

    applyUsage(usage, response.usage);

    const newMessages = response.response.messages as ModelMessage[];

    // Check for final_result tool result
    const finalResult = response.toolResults.find((r) => r.toolName === FINAL_RESULT_TOOL);
    if (finalResult && agent.outputSchema) {
      const parsed = agent.outputSchema.safeParse(finalResult.input);
      if (!parsed.success) {
        messages.push(...newMessages);
        nudgeWithValidationError(ctx, messages, agent.maxRetries, parsed.error);
        continue;
      }
      try {
        const output = await runValidators(agent.resultValidators, ctx, parsed.data as TOutput);
        return { output, messages: [...messages, ...newMessages], usage: { ...usage }, retryCount: ctx.retryCount, runId };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        messages.push(...newMessages);
        nudgeWithValidationError(ctx, messages, agent.maxRetries, error);
        continue;
      }
    }

    // No tool calls — text response
    if (response.toolCalls.length === 0) {
      if (agent.outputSchema) {
        messages.push(...newMessages);
        nudgeForFinalResult(ctx, messages, agent.maxRetries);
        continue;
      }
      return { output: response.text as TOutput, messages: [...messages, ...newMessages], usage: { ...usage }, retryCount: ctx.retryCount, runId };
    }

    // Other tool calls — continue loop
    messages.push(...newMessages);
  }

  throw new MaxTurnsError(agent.maxTurns);
}
