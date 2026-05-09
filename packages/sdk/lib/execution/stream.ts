import { stepCountIs, streamText } from "ai";
import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { RunContext, Usage } from "../types/context.ts";
import type { StreamResult } from "../types/results.ts";
import {
  applyUsage,
  buildInitialMessages,
  buildResponseMessages,
  checkModelRequestsAllowed,
  createRunContext,
  createSequentialMutex,
  initToolsetsForRun,
  type InternalRunOpts,
  isFinalResultTool,
  modelSettingsToAISDKOptions,
  normaliseSchemas,
  nudgeForFinalResult,
  nudgeWithValidationError,
  parseTextOutput,
  prepareTurn,
  resolveEndStrategy,
  resolveModelSettings,
  resolveSystemPrompt,
  resolveTelemetry,
  runValidators,
  unionToolIndex,
} from "./_run_utils.ts";
import { isBinaryImageOutput } from "../multimodal/binary_content.ts";
import { MaxTurnsError } from "../types/errors.ts";

// ---------------------------------------------------------------------------
// Deferred result - single promise resolves output + messages + usage together
// ---------------------------------------------------------------------------

interface DeferredResult<TOutput> {
  promise: Promise<{
    output: TOutput;
    messages: ModelMessage[];
    newMessages: ModelMessage[];
    usage: Usage;
  }>;
  resolve: (v: {
    output: TOutput;
    messages: ModelMessage[];
    newMessages: ModelMessage[];
    usage: Usage;
  }) => void;
  reject: (e: unknown) => void;
}

function createDeferred<TOutput>(): DeferredResult<TOutput> {
  let resolve!: DeferredResult<TOutput>["resolve"];
  let reject!: DeferredResult<TOutput>["reject"];
  const promise = new Promise<{
    output: TOutput;
    messages: ModelMessage[];
    newMessages: ModelMessage[];
    usage: Usage;
  }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// ReadableStream → AsyncIterable bridge
// ---------------------------------------------------------------------------

async function* readableToAsyncIterable<T>(
  stream: ReadableStream<T>,
): AsyncGenerator<T> {
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
  opts: InternalRunOpts<TDeps, TOutput>,
): StreamResult<TOutput> {
  checkModelRequestsAllowed(opts._bypassModelRequestsCheck);

  const deferred = createDeferred<TOutput>();

  let textController!: ReadableStreamDefaultController<string>;
  const textReadable = new ReadableStream<string>({
    start: (c) => {
      textController = c;
    },
  });

  let partialController!: ReadableStreamDefaultController<TOutput>;
  const partialReadable = new ReadableStream<TOutput>({
    start: (c) => {
      partialController = c;
    },
  });

  runStreamLoop(
    agent,
    prompt,
    opts,
    textController,
    partialController,
    deferred,
  );

  return {
    textStream: readableToAsyncIterable(textReadable),
    partialOutput: readableToAsyncIterable(partialReadable),
    output: deferred.promise.then((r) => r.output),
    messages: deferred.promise.then((r) => r.messages),
    newMessages: deferred.promise.then((r) => r.newMessages),
    usage: deferred.promise.then((r) => r.usage),
  };
}

// ---------------------------------------------------------------------------
// Background loop
// ---------------------------------------------------------------------------

async function runStreamLoop<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  prompt: string,
  opts: InternalRunOpts<TDeps, TOutput>,
  textController: ReadableStreamDefaultController<string>,
  partialController: ReadableStreamDefaultController<TOutput>,
  deferred: DeferredResult<TOutput>,
): Promise<void> {
  const ctx: RunContext<TDeps> = createRunContext(
    agent,
    opts.deps,
    opts.metadata ?? {},
  );
  const { usage } = ctx;
  let streamClosed = false;

  const model = opts._override?.model ?? agent.model;
  const maxTurns = opts._override?.maxTurns ?? agent.maxTurns;
  const maxRetries = opts._override?.maxRetries ?? agent.maxRetries;
  const resultValidators = opts._override?.resultValidators ??
    agent.resultValidators;
  const modelSettingsRaw = resolveModelSettings(agent, opts);
  const modelSettings = modelSettingsToAISDKOptions(modelSettingsRaw);
  const endStrategy = resolveEndStrategy(agent, opts);
  const telemetry = resolveTelemetry(agent, opts);
  const outputMode = agent.outputMode;
  const outputSchema = agent.outputSchema;
  const schemas = isBinaryImageOutput(outputSchema) ? [] : normaliseSchemas(outputSchema);

  // Shared mutex for sequential tools - created once per run
  const sequentialMutex = createSequentialMutex();

  // systemPrompt resolved once; instructions resolved per-turn inside prepareTurn
  const systemPrompt = await resolveSystemPrompt(
    agent,
    ctx,
    opts._override?.systemPrompts,
  );

  // Resolve run-scoped toolsets once before the turn loop (forRun lifecycle hook).
  const rawToolsets = opts._override?.toolsets ?? agent.toolsets;
  const runScopedToolsets = await initToolsetsForRun(rawToolsets, ctx);

  const inputOffset = opts.messageHistory?.length ?? 0;
  const messages = buildInitialMessages(opts.messageHistory, prompt);

  const closeStreams = () => {
    if (!streamClosed) {
      streamClosed = true;
      textController.close();
      try {
        partialController.close();
      } catch {
        // already closed
      }
    }
  };

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      const { tools, msgsForModel, system, outputToolNames, aiToolChoice } =
        await prepareTurn(
          agent,
          opts,
          ctx,
          messages,
          systemPrompt,
          sequentialMutex,
          runScopedToolsets,
        );

      const toolChoiceOpt = aiToolChoice !== undefined
        ? { toolChoice: aiToolChoice as "auto" | "none" | "required" }
        : {};

      const stream = streamText({
        model,
        system,
        messages: msgsForModel,
        tools,
        stopWhen: stepCountIs(1),
        ...(telemetry !== undefined
          ? { experimental_telemetry: telemetry }
          : {}),
        ...toolChoiceOpt,
        ...modelSettings,
      });

      let accumulatedText = "";
      // Track streaming tool input args for partial output.
      // Maps tool call ID → { toolName, accumulatedDelta }
      const toolInputBuffers = new Map<
        string,
        { toolName: string; args: string }
      >();

      for await (const chunk of stream.fullStream) {
        if (chunk.type === "text-delta") {
          // AI SDK v6: text-delta carries `.text` (not `.textDelta`)
          accumulatedText += chunk.text;
          textController.enqueue(chunk.text);
        } else if (chunk.type === "tool-input-start" && outputMode === "tool") {
          // Record the tool name for this ID so we can use it in tool-input-delta
          toolInputBuffers.set(chunk.id, {
            toolName: chunk.toolName,
            args: "",
          });
        } else if (chunk.type === "tool-input-delta" && outputMode === "tool") {
          const entry = toolInputBuffers.get(chunk.id);
          if (entry && isFinalResultTool(entry.toolName)) {
            const updated = entry.args + chunk.delta;
            toolInputBuffers.set(chunk.id, { ...entry, args: updated });

            // Best-effort parse of partial args
            const idx = unionToolIndex(entry.toolName) ?? 0;
            const schema = schemas[idx] ?? schemas[0];
            if (schema) {
              try {
                const partial = JSON.parse(updated);
                const parsed = schema.safeParse(partial);
                if (parsed.success) {
                  try {
                    partialController.enqueue(parsed.data as TOutput);
                  } catch {
                    // stream already closed - ignore
                  }
                }
              } catch {
                // incomplete JSON - not yet parseable, skip
              }
            }
          }
        }
      }

      const [streamUsage, toolCalls, toolResults, responseData] = await Promise
        .all([
          stream.usage,
          stream.toolCalls,
          stream.toolResults,
          stream.response,
        ]);

      applyUsage(usage, streamUsage);

      const newMessages = buildResponseMessages(
        (responseData.messages ?? []) as ModelMessage[],
        accumulatedText,
      );

      // Check for output tool result (user-defined tools that end the run)
      const outputResult = toolResults.find(
        (r) => outputToolNames.has(r.toolName),
      );
      if (outputResult) {
        const rawOutput = (outputResult as unknown as { output: unknown })
          .output as TOutput;
        try {
          const output = await runValidators(
            resultValidators,
            ctx,
            rawOutput,
          );
          void endStrategy;
          const allMessages = [...messages, ...newMessages];
          closeStreams();
          deferred.resolve({
            output,
            messages: allMessages,
            newMessages: allMessages.slice(inputOffset),
            usage: { ...usage },
          });
          return;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          messages.push(...newMessages);
          nudgeWithValidationError(ctx, messages, maxRetries, error);
          continue;
        }
      }

      // ---------------------------------------------------------------------------
      // Prompted output mode
      // ---------------------------------------------------------------------------
      if (outputMode === "prompted" && schemas.length > 0) {
        if (accumulatedText.trim().length > 0) {
          const parseResult = parseTextOutput<TOutput>(
            accumulatedText,
            isBinaryImageOutput(outputSchema) ? undefined : outputSchema,
          );
          if (!parseResult.success) {
            messages.push(...newMessages);
            nudgeWithValidationError(
              ctx,
              messages,
              maxRetries,
              parseResult.error,
            );
            continue;
          }
          try {
            const output = await runValidators(
              resultValidators,
              ctx,
              parseResult.data,
            );
            void endStrategy;
            const allMessages = [...messages, ...newMessages];
            closeStreams();
            deferred.resolve({
              output,
              messages: allMessages,
              newMessages: allMessages.slice(inputOffset),
              usage: { ...usage },
            });
            return;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            messages.push(...newMessages);
            nudgeWithValidationError(ctx, messages, maxRetries, error);
            continue;
          }
        }
        messages.push(...newMessages);
        nudgeForFinalResult(ctx, messages, maxRetries);
        continue;
      }

      // ---------------------------------------------------------------------------
      // Check for final_result (or final_result_N) tool result - tool mode
      // ---------------------------------------------------------------------------
      const finalResultEntry = toolResults.find(
        (r) => isFinalResultTool(r.toolName),
      );
      if (finalResultEntry && schemas.length > 0) {
        const idx = unionToolIndex(finalResultEntry.toolName) ?? 0;
        const schema = schemas[idx] ?? schemas[0];
        const parsed = schema.safeParse(finalResultEntry.input);
        if (!parsed.success) {
          messages.push(...newMessages);
          nudgeWithValidationError(
            ctx,
            messages,
            maxRetries,
            parsed.error,
          );
          continue;
        }
        try {
          const output = await runValidators(
            resultValidators,
            ctx,
            parsed.data as TOutput,
          );

          // With 'exhaustive' strategy, ensure all other tool results in this
          // response have been awaited before resolving. streamText with
          // stepCountIs(1) already awaits all tool executions, so by the time
          // `toolResults` resolves, all tools have run. The strategy is stored
          // for callers.
          void endStrategy; // acknowledged

          const allMessages = [...messages, ...newMessages];
          closeStreams();
          deferred.resolve({
            output,
            messages: allMessages,
            newMessages: allMessages.slice(inputOffset),
            usage: { ...usage },
          });
          return;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          messages.push(...newMessages);
          nudgeWithValidationError(ctx, messages, maxRetries, error);
          continue;
        }
      }

      // No tool calls - text response
      if (toolCalls.length === 0) {
        if (schemas.length > 0) {
          messages.push(...newMessages);
          nudgeForFinalResult(ctx, messages, maxRetries);
          continue;
        }
        const allMessages = [...messages, ...newMessages];
        closeStreams();
        deferred.resolve({
          output: accumulatedText as TOutput,
          messages: allMessages,
          newMessages: allMessages.slice(inputOffset),
          usage: { ...usage },
        });
        return;
      }

      // Other tool calls - continue loop
      messages.push(...newMessages);
    }

    throw new MaxTurnsError(maxTurns);
  } catch (err) {
    closeStreams();
    deferred.reject(err);
  }
}
