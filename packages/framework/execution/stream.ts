import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { RunContext } from "../types/run_context.ts";
import type { StreamResult } from "../types/result.ts";
import type { Usage } from "../types/usage.ts";
import {
  applyUsage,
  buildInitialMessages,
  buildToolMap,
  buildResponseMessages,
  createRunContext,
  FINAL_RESULT_TOOL,
  nudgeForFinalResult,
  nudgeWithValidationError,
  resolveSystemPrompt,
  runValidators,
  toolsOrUndefined,
} from "./_run_utils.ts";
import { MaxTurnsError } from "../errors.ts";

// ---------------------------------------------------------------------------
// Deferred result — single promise resolves output + messages + usage together
// ---------------------------------------------------------------------------

interface DeferredResult<TOutput> {
  promise: Promise<{ output: TOutput; messages: ModelMessage[]; usage: Usage }>;
  resolve: (v: { output: TOutput; messages: ModelMessage[]; usage: Usage }) => void;
  reject: (e: unknown) => void;
}

function createDeferred<TOutput>(): DeferredResult<TOutput> {
  let resolve!: DeferredResult<TOutput>["resolve"];
  let reject!: DeferredResult<TOutput>["reject"];
  const promise = new Promise<{ output: TOutput; messages: ModelMessage[]; usage: Usage }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// ReadableStream → AsyncIterable bridge
// ---------------------------------------------------------------------------

async function* readableToAsyncIterable(stream: ReadableStream<string>): AsyncGenerator<string> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Main streaming entry point
// ---------------------------------------------------------------------------

export function executeStream<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  prompt: string,
  opts: { deps: TDeps; messageHistory?: ModelMessage[] },
): StreamResult<TOutput> {
  const deferred = createDeferred<TOutput>();

  let textController!: ReadableStreamDefaultController<string>;
  const textReadable = new ReadableStream<string>({ start: (c) => { textController = c; } });

  runStreamLoop(agent, prompt, opts, textController, deferred);

  return {
    textStream: readableToAsyncIterable(textReadable),
    output: deferred.promise.then((r) => r.output),
    messages: deferred.promise.then((r) => r.messages),
    usage: deferred.promise.then((r) => r.usage),
  };
}

// ---------------------------------------------------------------------------
// Background loop
// ---------------------------------------------------------------------------

async function runStreamLoop<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  prompt: string,
  opts: { deps: TDeps; messageHistory?: ModelMessage[] },
  textController: ReadableStreamDefaultController<string>,
  deferred: DeferredResult<TOutput>,
): Promise<void> {
  const ctx: RunContext<TDeps> = createRunContext(opts.deps);
  const { usage } = ctx;

  const systemPrompt = await resolveSystemPrompt(agent as Agent<TDeps, unknown>, ctx);
  const messages = buildInitialMessages(opts.messageHistory, prompt);
  const toolMap = buildToolMap(agent as Agent<TDeps, unknown>, ctx);
  const tools = toolsOrUndefined(toolMap);

  try {
    for (let turn = 0; turn < agent.maxTurns; turn++) {
      const stream = streamText({
        model: agent.model,
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(1),
      });

      let accumulatedText = "";
      for await (const delta of stream.textStream) {
        accumulatedText += delta;
        textController.enqueue(delta);
      }

      const [streamUsage, toolCalls, toolResults, responseData] = await Promise.all([
        stream.usage,
        stream.toolCalls,
        stream.toolResults,
        stream.response,
      ]);

      applyUsage(usage, streamUsage);

      // response.messages is populated for tool-call turns but empty for text-only turns.
      // Fall back to constructing the assistant message from accumulated text.
      const newMessages = buildResponseMessages(
        (responseData.messages ?? []) as ModelMessage[],
        accumulatedText,
      );

      // Check for final_result tool result
      const finalResult = toolResults.find((r) => r.toolName === FINAL_RESULT_TOOL);
      if (finalResult && agent.outputSchema) {
        const parsed = agent.outputSchema.safeParse(finalResult.input);
        if (!parsed.success) {
          messages.push(...newMessages);
          nudgeWithValidationError(ctx, messages, agent.maxRetries, parsed.error);
          continue;
        }
        try {
          const output = await runValidators(agent.resultValidators, ctx, parsed.data as TOutput);
          textController.close();
          deferred.resolve({ output, messages: [...messages, ...newMessages], usage: { ...usage } });
          return;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          messages.push(...newMessages);
          nudgeWithValidationError(ctx, messages, agent.maxRetries, error);
          continue;
        }
      }

      // No tool calls — text response
      if (toolCalls.length === 0) {
        if (agent.outputSchema) {
          messages.push(...newMessages);
          nudgeForFinalResult(ctx, messages, agent.maxRetries);
          continue;
        }
        textController.close();
        deferred.resolve({ output: accumulatedText as TOutput, messages: [...messages, ...newMessages], usage: { ...usage } });
        return;
      }

      // Other tool calls — continue loop
      messages.push(...newMessages);
    }

    throw new MaxTurnsError(agent.maxTurns);
  } catch (err) {
    try { textController.close(); } catch { /* already closed */ }
    deferred.reject(err);
  }
}
