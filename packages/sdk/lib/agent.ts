import type { LanguageModel, ModelMessage } from "ai";
import type { ZodType } from "zod";
import type { RunContext } from "./types/context.ts";
import type {
  ResultValidator,
  RunResult,
  StreamResult,
} from "./types/results.ts";
import type { BinaryImageOutputSentinel } from "./multimodal/binary_content.ts";
import type { OutputMode } from "./types/output_mode.ts";
import type { ToolDefinition } from "./tool.ts";
import type { Toolset } from "./toolsets/toolset.ts";
import type { UsageLimits } from "./types/usage_limits.ts";
import type { HistoryProcessor } from "./history/processor.ts";
import type { ModelSettings } from "./types/model_settings.ts";
import type { TelemetrySettings } from "./otel/otel_types.ts";
import type { InternalRunOpts } from "./execution/_run_utils.ts";
import type { AgentStreamEvent, EventStreamHandler } from "./types/events.ts";
import type {
  DeferredToolHandler,
  DeferredToolRequests,
  DeferredToolResults,
} from "./execution/deferred.ts";
import { executeRun } from "./execution/run.ts";
import { executeStream } from "./execution/stream.ts";
import { executeStreamEvents } from "./execution/event_stream.ts";

export type SystemPromptFn<TDeps> = (
  ctx: RunContext<TDeps>,
) => string | Promise<string>;

/** Alias for the instructions field - same signature as systemPrompt. */
export type InstructionsFn<TDeps> = SystemPromptFn<TDeps>;

/**
 * Controls when the agent stops after receiving a `final_result` tool call.
 *
 * - `'early'` (default): Stop as soon as `final_result` is found, even if other
 *   tool calls were returned in the same response.
 * - `'exhaustive'`: Execute all other tool calls in the same response before
 *   returning the final result.
 */
export type EndStrategy = "early" | "exhaustive";

export interface AgentOptions<TDeps, TOutput> {
  /** Human-readable name for this agent. */
  name?: string;
  /** Vercel AI SDK model instance (e.g. anthropic("claude-..."), openai("gpt-...")) */
  model: LanguageModel;
  /** System prompt - a static string or a dynamic function. */
  systemPrompt?: string | SystemPromptFn<TDeps>;
  /**
   * Instructions injected each turn as part of the system prompt but NOT
   * recorded in `result.messages` / `result.newMessages`. Same signature as
   * `systemPrompt`. Equivalent to Pydantic AI's `instructions`.
   */
  instructions?: string | InstructionsFn<TDeps>;
  /** Tools available to the model. */
  tools?: ToolDefinition<TDeps>[];
  /** Composable toolsets (resolved per-turn). Combined with `tools`. */
  toolsets?: Toolset<TDeps>[];
  /** Zod schema for structured output. If omitted, output type is string.
   *  Pass `BINARY_IMAGE_OUTPUT` sentinel to indicate the agent returns a
   *  `BinaryContent` image as its output (first tool image result wins). */
  outputSchema?: ZodType<TOutput> | ZodType[] | BinaryImageOutputSentinel;
  /**
   * How structured output is delivered to the model.
   * - `'tool'` (default): Inject a `final_result` tool the model must call.
   * - `'native'`: Use the AI SDK's native structured-output mode (JSON mode).
   * - `'prompted'`: Inject the JSON schema into the system prompt; parse text response.
   */
  outputMode?: OutputMode;
  /**
   * When `false`, suppress schema injection into the system prompt.
   * Defaults to `true`. Works with any `outputMode`.
   */
  outputTemplate?: boolean;
  /** Validators run after structured output is parsed. Throw to reject and retry. */
  resultValidators?: ResultValidator<TDeps, TOutput>[];
  /** Max retries for result validation failures. Default: 3 */
  maxRetries?: number;
  /** Max tool-call round trips before giving up. Default: 10 */
  maxTurns?: number;
  /** Cap cumulative token/request usage during a run. */
  usageLimits?: UsageLimits;
  /** Transform message history before each model call (trim, summarise, filter). */
  historyProcessors?: HistoryProcessor<TDeps>[];
  /**
   * Model-specific settings (temperature, maxTokens, etc.) passed to
   * `generateText` / `streamText` on every turn.
   */
  modelSettings?: ModelSettings;
  /**
   * When to stop after receiving a `final_result` tool call.
   * `'early'` (default) stops immediately; `'exhaustive'` runs all other
   * tool calls in the same response first.
   */
  endStrategy?: EndStrategy;
  /**
   * Maximum number of tool executions that may run concurrently within a
   * single model turn. Defaults to unlimited.
   */
  maxConcurrency?: number;
  /**
   * OpenTelemetry telemetry settings passed to every `generateText` /
   * `streamText` call as `experimental_telemetry`. When set, the AI SDK
   * automatically creates spans for model calls and tool invocations.
   *
   * Use `instrumentAgent()` from `@vibesjs/sdk/otel` for a convenient
   * wrapper that sets this up automatically.
   */
  telemetry?: TelemetrySettings;
  /**
   * Handler called automatically when one or more tool calls require approval,
   * instead of pausing the run and throwing `ApprovalRequiredError`.
   *
   * Receives the `RunContext` and `DeferredToolRequests`. Return
   * `DeferredToolResults` to resolve the calls and continue the run
   * automatically, or `null` to decline (which causes `ApprovalRequiredError`
   * to be thrown as usual, allowing manual `agent.resume()` handling).
   *
   * Equivalent to pydantic-ai's `HandleDeferredToolCalls` capability.
   *
   * @example
   * ```ts
   * const agent = new Agent({
   *   model,
   *   tools: [sensitiveOp],
   *   deferredToolHandler: async (_ctx, requests) => ({
   *     results: requests.requests.map((r) => ({
   *       toolCallId: r.toolCallId,
   *       result: "approved",
   *     })),
   *   }),
   * });
   * ```
   */
  deferredToolHandler?: DeferredToolHandler<TDeps>;
  /**
   * Observer or processor for the event stream emitted by `runStreamEvents()`.
   *
   * Two calling conventions:
   * - **Observer** (`async (ctx, stream) => void`): Receives all events for
   *   side effects while events pass through unchanged to downstream.
   * - **Processor** (`async function*(ctx, stream) { yield ... }`): Async
   *   generator that can add, remove, or transform events.
   *
   * The form is detected at runtime via `[Symbol.asyncIterator]`.
   *
   * Equivalent to pydantic-ai's `ProcessEventStream` capability.
   *
   * @example
   * ```ts
   * // Observer: log every event
   * const agent = new Agent({
   *   model,
   *   eventStreamHandler: async (_ctx, stream) => {
   *     for await (const event of stream) console.log(event.kind);
   *   },
   * });
   * ```
   */
  eventStreamHandler?: EventStreamHandler<TDeps, TOutput>;
}

/** Options accepted by `agent.run()` and `agent.stream()`. */
export interface RunOptions<TDeps> {
  deps?: TDeps;
  messageHistory?: ModelMessage[];
  /** Per-run metadata accessible on `ctx.metadata` in tools and validators. */
  metadata?: Record<string, unknown>;
  /** Per-run usage limits (override the agent-level limits). */
  usageLimits?: UsageLimits;
  /** Per-run model settings (override the agent-level modelSettings). */
  modelSettings?: ModelSettings;
  /** Per-run end strategy (override the agent-level endStrategy). */
  endStrategy?: EndStrategy;
  /**
   * Deferred tool results to inject when resuming a paused run.
   * Normally not set directly - use `agent.resume()` instead.
   */
  deferredResults?: DeferredToolResults;
  /**
   * Per-run telemetry settings. Overrides the agent-level `telemetry` option.
   * Passed to `generateText` / `streamText` as `experimental_telemetry`.
   */
  telemetry?: TelemetrySettings;
  /**
   * Per-run deferred tool handler. Overrides the agent-level `deferredToolHandler`.
   * See `AgentOptions.deferredToolHandler` for full documentation.
   */
  deferredToolHandler?: DeferredToolHandler<TDeps>;
  /**
   * Per-run event stream handler. Overrides the agent-level `eventStreamHandler`.
   * Only applies when using `runStreamEvents()`.
   * See `AgentOptions.eventStreamHandler` for full documentation.
   */
  eventStreamHandler?: EventStreamHandler<TDeps, unknown>;
  /**
   * Conversation identifier for cross-run correlation.
   *
   * A conversation spans multiple agent runs that share message history.
   * If omitted, a fresh UUID is generated for each run. Pass
   * `result.conversationId` from a previous run to group runs together.
   *
   * Equivalent to Pydantic AI's `conversation_id` on `agent.run()`.
   */
  conversationId?: string;
}

/** Options accepted by `agent.override()`. */
export interface AgentOverrideOptions<TDeps, TOutput> {
  model?: LanguageModel;
  systemPrompt?: string | SystemPromptFn<TDeps>;
  instructions?: string | InstructionsFn<TDeps>;
  tools?: ToolDefinition<TDeps>[];
  toolsets?: Toolset<TDeps>[];
  resultValidators?: ResultValidator<TDeps, TOutput>[];
  maxRetries?: number;
  maxTurns?: number;
  usageLimits?: UsageLimits;
  historyProcessors?: HistoryProcessor<TDeps>[];
  modelSettings?: ModelSettings;
  endStrategy?: EndStrategy;
  /** Override telemetry settings for this run. */
  telemetry?: TelemetrySettings;
  /** Override deferred tool handler for this run. */
  deferredToolHandler?: DeferredToolHandler<TDeps>;
  /** Override event stream handler for this run. */
  eventStreamHandler?: EventStreamHandler<TDeps, TOutput>;
}

export class Agent<TDeps = undefined, TOutput = string> {
  readonly name: string | undefined;
  readonly model: LanguageModel;
  readonly outputSchema: ZodType<TOutput> | ZodType[] | BinaryImageOutputSentinel | undefined;
  readonly outputMode: OutputMode;
  readonly outputTemplate: boolean;
  readonly maxRetries: number;
  readonly maxTurns: number;
  readonly usageLimits: UsageLimits | undefined;
  readonly modelSettings: ModelSettings | undefined;
  readonly endStrategy: EndStrategy;
  readonly maxConcurrency: number | undefined;
  readonly telemetry: TelemetrySettings | undefined;
  readonly deferredToolHandler: DeferredToolHandler<TDeps> | undefined;
  readonly eventStreamHandler: EventStreamHandler<TDeps, TOutput> | undefined;

  private _systemPrompts: (string | SystemPromptFn<TDeps>)[];
  private _instructions: (string | InstructionsFn<TDeps>)[];
  private _tools: ToolDefinition<TDeps>[];
  private _toolsets: Toolset<TDeps>[];
  private _resultValidators: ResultValidator<TDeps, TOutput>[];
  private _historyProcessors: HistoryProcessor<TDeps>[];

  constructor(opts: AgentOptions<TDeps, TOutput>) {
    this.name = opts.name;
    this.model = opts.model;
    this.outputSchema = opts.outputSchema;
    this.outputMode = opts.outputMode ?? "tool";
    this.outputTemplate = opts.outputTemplate ?? true;
    this.maxRetries = opts.maxRetries ?? 3;
    this.maxTurns = opts.maxTurns ?? 10;
    this.usageLimits = opts.usageLimits;
    this.modelSettings = opts.modelSettings;
    this.endStrategy = opts.endStrategy ?? "early";
    this.maxConcurrency = opts.maxConcurrency;
    this.telemetry = opts.telemetry;
    this.deferredToolHandler = opts.deferredToolHandler;
    this.eventStreamHandler = opts.eventStreamHandler;

    this._systemPrompts = opts.systemPrompt ? [opts.systemPrompt] : [];
    this._instructions = opts.instructions ? [opts.instructions] : [];

    this._tools = opts.tools ? [...opts.tools] : [];
    this._toolsets = opts.toolsets ? [...opts.toolsets] : [];
    this._resultValidators = opts.resultValidators
      ? [...opts.resultValidators]
      : [];
    this._historyProcessors = opts.historyProcessors
      ? [...opts.historyProcessors]
      : [];
  }

  addTool(t: ToolDefinition<TDeps>): void {
    this._tools.push(t);
  }

  addToolset(ts: Toolset<TDeps>): void {
    this._toolsets.push(ts);
  }

  addSystemPrompt(prompt: string | SystemPromptFn<TDeps>): void {
    this._systemPrompts.push(prompt);
  }

  addInstruction(instruction: string | InstructionsFn<TDeps>): void {
    this._instructions.push(instruction);
  }

  addResultValidator(validator: ResultValidator<TDeps, TOutput>): void {
    this._resultValidators.push(validator);
  }

  addHistoryProcessor(processor: HistoryProcessor<TDeps>): void {
    this._historyProcessors.push(processor);
  }

  get systemPrompts(): ReadonlyArray<string | SystemPromptFn<TDeps>> {
    return this._systemPrompts;
  }

  get instructions(): ReadonlyArray<string | InstructionsFn<TDeps>> {
    return this._instructions;
  }

  get tools(): ReadonlyArray<ToolDefinition<TDeps>> {
    return this._tools;
  }

  get toolsets(): ReadonlyArray<Toolset<TDeps>> {
    return this._toolsets;
  }

  get resultValidators(): ReadonlyArray<ResultValidator<TDeps, TOutput>> {
    return this._resultValidators;
  }

  get historyProcessors(): ReadonlyArray<HistoryProcessor<TDeps>> {
    return this._historyProcessors;
  }

  run(
    prompt: string,
    opts?: RunOptions<TDeps>,
  ): Promise<RunResult<TOutput>> {
    return executeRun<TDeps, TOutput>(this, prompt, {
      deps: opts?.deps as TDeps,
      messageHistory: opts?.messageHistory,
      metadata: opts?.metadata,
      usageLimits: opts?.usageLimits,
      modelSettings: opts?.modelSettings,
      endStrategy: opts?.endStrategy,
      deferredResults: opts?.deferredResults,
      telemetry: opts?.telemetry,
      deferredToolHandler: opts?.deferredToolHandler,
      conversationId: opts?.conversationId,
    });
  }

  /**
   * Resume a paused run after providing human approval for deferred tool calls.
   *
   * Usage:
   * ```ts
   * try {
   *   const result = await agent.run(prompt);
   * } catch (err) {
   *   if (err instanceof ApprovalRequiredError) {
   *     // Inspect err.deferred.requests, decide to approve/reject/modify
   *     const results: DeferredToolResults = {
   *       results: [{ toolCallId: "tc1", result: "approved result" }],
   *     };
   *     const finalResult = await agent.resume(err.deferred, results);
   *   }
   * }
   * ```
   *
   * @param deferred - The `DeferredToolRequests` from the caught `ApprovalRequiredError`.
   * @param results - The human-approved results for each pending tool call.
   * @param opts - Additional run options (deps, metadata, etc.).
   */
  resume(
    deferred: DeferredToolRequests,
    results: DeferredToolResults,
    opts?: Omit<RunOptions<TDeps>, "messageHistory" | "deferredResults">,
  ): Promise<RunResult<TOutput>> {
    // Resume state contains the full message history up to (and including)
    // the assistant's tool call message that triggered the approval gate.
    // We pass it as messageHistory with _resumeFromDeferred=true so the
    // run loop does NOT prepend a new user message.
    const { messages } = deferred._resumeState;

    return executeRun<TDeps, TOutput>(this, "", {
      deps: opts?.deps as TDeps,
      messageHistory: messages,
      metadata: opts?.metadata,
      usageLimits: opts?.usageLimits,
      modelSettings: opts?.modelSettings,
      endStrategy: opts?.endStrategy,
      deferredResults: results,
      deferredToolHandler: opts?.deferredToolHandler,
      _resumeFromDeferred: true,
      _deferredPendingRequests: deferred.requests,
    });
  }

  stream(
    prompt: string,
    opts?: RunOptions<TDeps>,
  ): StreamResult<TOutput> {
    return executeStream<TDeps, TOutput>(this, prompt, {
      deps: opts?.deps as TDeps,
      messageHistory: opts?.messageHistory,
      metadata: opts?.metadata,
      usageLimits: opts?.usageLimits,
      modelSettings: opts?.modelSettings,
      endStrategy: opts?.endStrategy,
      telemetry: opts?.telemetry,
      conversationId: opts?.conversationId,
    });
  }

  /**
   * Returns an `AsyncIterable<AgentStreamEvent<TOutput>>` that emits typed
   * events as the agent processes the prompt across one or more turns.
   *
   * Events are emitted in order:
   * - `turn-start` at the beginning of each model turn
   * - `text-delta` for each streamed text token
   * - `partial-output` for best-effort partial structured output (tool mode)
   * - `tool-call-start` / `tool-call-result` around every tool invocation
   * - `usage-update` after each turn completes
   * - `final-result` once the agent has a validated output
   * - `error` if an unrecoverable error occurs
   */
  runStreamEvents(
    prompt: string,
    opts?: RunOptions<TDeps>,
  ): AsyncIterable<AgentStreamEvent<TOutput>> {
    return executeStreamEvents<TDeps, TOutput>(this, prompt, {
      deps: opts?.deps as TDeps,
      messageHistory: opts?.messageHistory,
      metadata: opts?.metadata,
      usageLimits: opts?.usageLimits,
      modelSettings: opts?.modelSettings,
      endStrategy: opts?.endStrategy,
      telemetry: opts?.telemetry,
      eventStreamHandler: opts?.eventStreamHandler as EventStreamHandler<TDeps, TOutput> | undefined,
      conversationId: opts?.conversationId,
    });
  }

  /**
   * Returns a scoped runner that overrides specific agent settings for a
   * single `run()` or `stream()` call. Does not mutate the original agent.
   * Critical for test patterns - override runs bypass the
   * `setAllowModelRequests(false)` guard.
   *
   * @example
   * ```ts
   * const result = await agent.override({ model: mockModel }).run(prompt);
   * ```
   */
  override(
    overrides: AgentOverrideOptions<TDeps, TOutput>,
  ): {
    run: (
      prompt: string,
      opts?: RunOptions<TDeps>,
    ) => Promise<RunResult<TOutput>>;
    stream: (prompt: string, opts?: RunOptions<TDeps>) => StreamResult<TOutput>;
    runStreamEvents: (
      prompt: string,
      opts?: RunOptions<TDeps>,
    ) => AsyncIterable<AgentStreamEvent<TOutput>>;
  } {
    const buildOpts = (
      _prompt: string,
      runOpts?: RunOptions<TDeps>,
    ): InternalRunOpts<TDeps, TOutput> => ({
      deps: runOpts?.deps as TDeps,
      messageHistory: runOpts?.messageHistory,
      metadata: runOpts?.metadata,
      usageLimits: runOpts?.usageLimits,
      modelSettings: runOpts?.modelSettings,
      endStrategy: runOpts?.endStrategy,
      deferredResults: runOpts?.deferredResults,
      telemetry: runOpts?.telemetry,
      deferredToolHandler: runOpts?.deferredToolHandler,
      eventStreamHandler: runOpts?.eventStreamHandler as EventStreamHandler<TDeps, TOutput> | undefined,
      conversationId: runOpts?.conversationId,
      _bypassModelRequestsCheck: true,
      _override: {
        model: overrides.model,
        systemPrompts: overrides.systemPrompt ? [overrides.systemPrompt] : undefined,
        instructions: overrides.instructions ? [overrides.instructions] : undefined,
        tools: overrides.tools,
        toolsets: overrides.toolsets,
        resultValidators: overrides.resultValidators,
        maxRetries: overrides.maxRetries,
        maxTurns: overrides.maxTurns,
        usageLimits: overrides.usageLimits,
        historyProcessors: overrides.historyProcessors,
        modelSettings: overrides.modelSettings,
        endStrategy: overrides.endStrategy,
        telemetry: overrides.telemetry,
        deferredToolHandler: overrides.deferredToolHandler,
        eventStreamHandler: overrides.eventStreamHandler,
      },
    });

    return {
      run: (prompt: string, opts?: RunOptions<TDeps>) => {
        return executeRun<TDeps, TOutput>(
          this,
          prompt,
          buildOpts(prompt, opts),
        );
      },
      stream: (prompt: string, opts?: RunOptions<TDeps>) => {
        return executeStream<TDeps, TOutput>(
          this,
          prompt,
          buildOpts(prompt, opts),
        );
      },
      runStreamEvents: (prompt: string, opts?: RunOptions<TDeps>) => {
        return executeStreamEvents<TDeps, TOutput>(
          this,
          prompt,
          buildOpts(prompt, opts),
        );
      },
    };
  }
}
