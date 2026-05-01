import { stepCountIs, streamText } from "ai";
import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { RunContext, Usage } from "../types/context.ts";
import type { AgentStreamEvent } from "../types/events.ts";
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
  resolveConversationId,
  resolveEndStrategy,
  resolveEventStreamHandler,
  resolveModelSettings,
  resolveSystemPrompt,
  resolveTelemetry,
  runValidators,
  unionToolIndex,
} from "./_run_utils.ts";
import { isBinaryImageOutput } from "../multimodal/binary_content.ts";
import { MaxTurnsError } from "../types/errors.ts";

// ---------------------------------------------------------------------------
// Main event-streaming entry point
// ---------------------------------------------------------------------------

/**
 * Returns an `AsyncIterable<AgentStreamEvent<TOutput>>` that drives the same
 * multi-turn loop as `executeStream()` but emits typed events instead of a
 * raw text stream.
 *
 * Event ordering per turn:
 *   turn-start → text-delta* → partial-output* → tool-call-start* →
 *   tool-call-result* → usage-update → (repeat or final-result / error)
 */
export function executeStreamEvents<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  prompt: string,
  opts: InternalRunOpts<TDeps, TOutput>,
): AsyncIterable<AgentStreamEvent<TOutput>> {
  checkModelRequestsAllowed(opts._bypassModelRequestsCheck);

  const handler = resolveEventStreamHandler(agent, opts);

  return {
    [Symbol.asyncIterator](): AsyncIterator<AgentStreamEvent<TOutput>> {
      if (!handler) {
        return runEventStreamLoop<TDeps, TOutput>(agent, prompt, opts);
      }
      // Create a shared context for the handler. We create it here so the
      // same ctx is available to both the inner loop and the handler.
      const ctx = createRunContext(agent, opts.deps, opts.metadata ?? {}, resolveConversationId(opts.conversationId));
      const inner = runEventStreamLoopWithCtx<TDeps, TOutput>(
        agent,
        prompt,
        opts,
        ctx,
      );
      return applyEventStreamHandler(ctx, inner, handler);
    },
  };
}

// ---------------------------------------------------------------------------
// Async generator - the actual turn loop
// ---------------------------------------------------------------------------

async function* runEventStreamLoop<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  prompt: string,
  opts: InternalRunOpts<TDeps, TOutput>,
): AsyncGenerator<AgentStreamEvent<TOutput>> {
  const ctx: RunContext<TDeps> = createRunContext(
    agent,
    opts.deps,
    opts.metadata ?? {},
    resolveConversationId(opts.conversationId),
  );
  yield* runEventStreamLoopWithCtx(agent, prompt, opts, ctx);
}

/**
 * Like `runEventStreamLoop` but accepts an externally-created `ctx` so the
 * same context can be shared with an `eventStreamHandler`.
 */
async function* runEventStreamLoopWithCtx<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  prompt: string,
  opts: InternalRunOpts<TDeps, TOutput>,
  ctx: RunContext<TDeps>,
): AsyncGenerator<AgentStreamEvent<TOutput>> {
  const { usage } = ctx;

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

  const sequentialMutex = createSequentialMutex();

  const systemPrompt = await resolveSystemPrompt(
    agent,
    ctx,
    opts._override?.systemPrompts,
  );

  // Resolve run-scoped toolsets once before the turn loop (forRun lifecycle hook).
  const rawToolsets = opts._override?.toolsets ?? agent.toolsets;
  const runScopedToolsets = await initToolsetsForRun(rawToolsets, ctx);

  const messages = buildInitialMessages(opts.messageHistory, prompt);

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      yield { kind: "turn-start", turn };

      const { tools, msgsForModel, system, outputToolNames } =
        await prepareTurn(
          agent,
          opts,
          ctx,
          messages,
          systemPrompt,
          sequentialMutex,
          runScopedToolsets,
        );

      const stream = streamText({
        model,
        system,
        messages: msgsForModel,
        tools,
        stopWhen: stepCountIs(1),
        ...(telemetry !== undefined
          ? { experimental_telemetry: telemetry }
          : {}),
        ...modelSettings,
      });

      let accumulatedText = "";
      // Maps toolCallId → { toolName, args } for streaming tool-input tracking
      const toolInputBuffers = new Map<
        string,
        { toolName: string; args: string }
      >();
      // Track which tool calls we have already emitted tool-call-start for,
      // so we don't double-emit if both tool-input-start and tool-call arrive.
      const emittedToolCallStart = new Set<string>();

      for await (const chunk of stream.fullStream) {
        if (chunk.type === "text-delta") {
          accumulatedText += chunk.text;
          yield { kind: "text-delta", delta: chunk.text };
        } else if (chunk.type === "tool-input-start") {
          toolInputBuffers.set(chunk.id, {
            toolName: chunk.toolName,
            args: "",
          });
        } else if (chunk.type === "tool-input-delta") {
          const entry = toolInputBuffers.get(chunk.id);
          if (entry) {
            const updated = entry.args + chunk.delta;
            toolInputBuffers.set(chunk.id, { ...entry, args: updated });

            if (outputMode === "tool" && isFinalResultTool(entry.toolName)) {
              // Best-effort partial output for final_result tool
              const idx = unionToolIndex(entry.toolName) ?? 0;
              const schema = schemas[idx] ?? schemas[0];
              if (schema) {
                try {
                  const partial = JSON.parse(updated);
                  const parsed = schema.safeParse(partial);
                  if (parsed.success) {
                    yield { kind: "partial-output", partial: parsed.data };
                  }
                } catch {
                  // incomplete JSON - not yet parseable, skip
                }
              }
            }
          }
        } else if (chunk.type === "tool-call") {
          // AI SDK v6 fullStream exposes tool-call once input is fully available.
          // chunk.input is already the parsed args object (not a JSON string).
          if (!emittedToolCallStart.has(chunk.toolCallId)) {
            emittedToolCallStart.add(chunk.toolCallId);
            const raw = chunk.input as unknown;
            let parsedArgs: Record<string, unknown> = {};
            if (
              raw !== null &&
              typeof raw === "object" &&
              !Array.isArray(raw)
            ) {
              parsedArgs = raw as Record<string, unknown>;
            }
            yield {
              kind: "tool-call-start",
              toolName: chunk.toolName,
              toolCallId: chunk.toolCallId,
              args: parsedArgs,
            };
          }
        }
        // tool-result chunks from fullStream have a DynamicToolResult shape that
        // does not expose a stable `result` field. Tool results are emitted below
        // after awaiting stream.toolResults, which provides the resolved output.
      }

      // Collect post-stream data
      const [streamUsage, toolCalls, toolResults, responseData] = await Promise
        .all([
          stream.usage,
          stream.toolCalls,
          stream.toolResults,
          stream.response,
        ]);

      applyUsage(usage, streamUsage);

      // Emit tool-call-result events for every resolved tool result.
      // We use stream.toolResults (the resolved array) rather than raw fullStream
      // chunks because it provides the typed output from tool execute functions.
      for (const tr of toolResults) {
        const resolved = tr as unknown as {
          toolCallId: string;
          toolName: string;
          output: unknown;
        };
        yield {
          kind: "tool-call-result",
          toolCallId: resolved.toolCallId,
          toolName: resolved.toolName,
          result: resolved.output,
        };
      }

      yield { kind: "usage-update", usage: snapshotUsage(usage) };

      const newMessages = buildResponseMessages(
        (responseData.messages ?? []) as ModelMessage[],
        accumulatedText,
      );

      // ------------------------------------------------------------------
      // Check for output tool result (user-defined isOutput tools)
      // ------------------------------------------------------------------
      const outputResult = toolResults.find(
        (r) => outputToolNames.has(r.toolName),
      );
      if (outputResult) {
        const rawOutput = (outputResult as unknown as { output: unknown })
          .output as TOutput;
        try {
          const output = await runValidators(resultValidators, ctx, rawOutput);
          void endStrategy;
          messages.push(...newMessages);
          yield { kind: "final-result", output };
          return;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          messages.push(...newMessages);
          nudgeWithValidationError(ctx, messages, maxRetries, error);
          continue;
        }
      }

      // ------------------------------------------------------------------
      // Prompted output mode
      // ------------------------------------------------------------------
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
            messages.push(...newMessages);
            yield { kind: "final-result", output };
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

      // ------------------------------------------------------------------
      // Tool output mode - check for final_result tool result
      // ------------------------------------------------------------------
      const finalResultEntry = toolResults.find((r) =>
        isFinalResultTool(r.toolName)
      );
      if (finalResultEntry && schemas.length > 0) {
        const idx = unionToolIndex(finalResultEntry.toolName) ?? 0;
        const schema = schemas[idx] ?? schemas[0];
        const parsed = schema.safeParse(finalResultEntry.input);
        if (!parsed.success) {
          messages.push(...newMessages);
          nudgeWithValidationError(ctx, messages, maxRetries, parsed.error);
          continue;
        }
        try {
          const output = await runValidators(
            resultValidators,
            ctx,
            parsed.data as TOutput,
          );
          void endStrategy;
          messages.push(...newMessages);
          yield { kind: "final-result", output };
          return;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          messages.push(...newMessages);
          nudgeWithValidationError(ctx, messages, maxRetries, error);
          continue;
        }
      }

      // ------------------------------------------------------------------
      // No tool calls - plain text response
      // ------------------------------------------------------------------
      if (toolCalls.length === 0) {
        if (schemas.length > 0) {
          messages.push(...newMessages);
          nudgeForFinalResult(ctx, messages, maxRetries);
          continue;
        }
        messages.push(...newMessages);
        yield { kind: "final-result", output: accumulatedText as TOutput };
        return;
      }

      // Other tool calls - continue turn loop
      messages.push(...newMessages);
    }

    throw new MaxTurnsError(maxTurns);
  } catch (err) {
    yield { kind: "error", error: err };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshotUsage(usage: Usage): Usage {
  return { ...usage };
}

// ---------------------------------------------------------------------------
// Event stream handler: observer and processor support
// ---------------------------------------------------------------------------

/** Empty async iterable for probing handler types. */
const EMPTY_STREAM: AsyncIterable<never> = {
  [Symbol.asyncIterator]() {
    return {
      next(): Promise<IteratorResult<never>> {
        return Promise.resolve({ value: undefined!, done: true });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  },
};

/**
 * Wrap an event generator with a user-supplied `EventStreamHandler`.
 *
 * Two calling conventions (detected at runtime):
 * - **Processor** (return has `[Symbol.asyncIterator]`): replaces the inner
 *   stream. Events yielded by the processor are what downstream consumers see.
 * - **Observer** (return is `Promise<void>` or `void`): receives a teed copy
 *   of the stream for side effects. Events pass through unchanged.
 *
 * Detection is done by probing with an empty stream first, which lets us
 * classify the handler without consuming any real events.
 */
function applyEventStreamHandler<TDeps, TOutput>(
  ctx: RunContext<TDeps>,
  inner: AsyncGenerator<AgentStreamEvent<TOutput>>,
  // deno-lint-ignore no-explicit-any
  handler: (ctx: RunContext<TDeps>, stream: AsyncIterable<any>) => any,
): AsyncGenerator<AgentStreamEvent<TOutput>> {
  // Probe with an empty stream to detect the handler form without consuming events.
  // - Async generator functions return an AsyncGenerator immediately (no code runs).
  // - Regular async functions run until first await, exhaust the empty stream, return void.
  const probe = handler(ctx, EMPTY_STREAM);

  if (
    probe !== null &&
    probe !== undefined &&
    typeof probe[Symbol.asyncIterator] === "function"
  ) {
    // Processor form: call handler with the real inner stream and yield its output.
    // We discard the probe (it wraps the empty stream, produces nothing).
    const processed = handler(
      ctx,
      inner,
    ) as AsyncIterable<AgentStreamEvent<TOutput>>;
    return processed[Symbol.asyncIterator]() as AsyncGenerator<
      AgentStreamEvent<TOutput>
    >;
  }

  // Observer form: `probe` is a Promise<void> (or void).
  // The handler has already drained the empty stream (quick resolve).
  // Now call the handler again with a queue-backed stream that we drive
  // from `inner` while also yielding events to downstream.
  return broadcastToObserver(ctx, inner, handler);
}

/**
 * Drive `inner`, broadcasting each event to both:
 * 1. A queue-backed stream consumed by the observer (handler), and
 * 2. The downstream consumer (via `yield`).
 *
 * The observer runs "concurrently" in JavaScript's single-threaded sense:
 * it processes events from its queue while the downstream generator yields.
 */
async function* broadcastToObserver<TDeps, TOutput>(
  ctx: RunContext<TDeps>,
  inner: AsyncGenerator<AgentStreamEvent<TOutput>>,
  // deno-lint-ignore no-explicit-any
  handler: (ctx: RunContext<TDeps>, stream: AsyncIterable<any>) => any,
): AsyncGenerator<AgentStreamEvent<TOutput>> {
  const buffer: AgentStreamEvent<TOutput>[] = [];
  let streamDone = false;
  // deno-lint-ignore no-explicit-any
  let notify: ((...args: any[]) => void) | null = null;

  // Create the observer's view of the event stream (queue-backed).
  const observerStream: AsyncIterable<AgentStreamEvent<TOutput>> = {
    [Symbol.asyncIterator]() {
      let idx = 0;
      return {
        async next(): Promise<IteratorResult<AgentStreamEvent<TOutput>>> {
          while (true) {
            if (idx < buffer.length) {
              return { value: buffer[idx++], done: false };
            }
            if (streamDone) {
              return { value: undefined!, done: true };
            }
            // Wait for the broadcaster to push a new event.
            await new Promise<void>((resolve) => {
              notify = resolve;
            });
          }
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },
  };

  // Start the observer (non-blocking; it will await events from observerStream).
  const observerPromise = Promise.resolve(handler(ctx, observerStream)).catch(
    () => {},
  );

  try {
    // Drive `inner` and broadcast to both observer buffer and downstream.
    for await (const event of inner) {
      buffer.push(event);
      // Notify observer that a new event is available.
      const n = notify;
      notify = null;
      if (n) (n as () => void)();
      // Yield to downstream consumer.
      yield event;
      // After the downstream consumer awaits next(), the observer's microtask
      // may run and read from the buffer.
    }
  } finally {
    streamDone = true;
    // Signal end-of-stream to observer.
    const n = notify;
    notify = null;
    if (n) (n as () => void)();
    // Wait for observer to finish processing all events.
    await observerPromise;
  }
}
