/**
 * Internal helpers shared between run.ts (non-streaming) and stream.ts (streaming).
 * Not part of the public API.
 */
import type {
  LanguageModel,
  LanguageModelUsage,
  ModelMessage,
  ToolSet,
} from "ai";
import type { Agent, EndStrategy } from "../agent.ts";
import type { HistoryProcessor } from "../history/processor.ts";
import type { RunContext, Usage } from "../types/context.ts";
import type { ResultValidator } from "../types/results.ts";
import type { ToolDefinition } from "../tool.ts";
import type { Toolset } from "../toolsets/toolset.ts";
import type { UsageLimits } from "../types/usage_limits.ts";
import type { ModelSettings } from "../types/model_settings.ts";
import type { TelemetrySettings } from "../otel/otel_types.ts";
import { createUsage } from "../types/context.ts";
import { toAISDKTools } from "../tool.ts";
import { Semaphore } from "../concurrency.ts";
import { checkUsageLimits } from "../types/usage_limits.ts";
import { MaxRetriesError } from "../types/errors.ts";
import { applyHistoryProcessors } from "../history/processor.ts";
import {
  _notifyModelRequest,
  assertModelRequestsAllowed,
} from "../testing/mod.ts";
import {
  binaryContentToToolResult,
  isBinaryContent,
  isBinaryImageOutput,
  isUploadedFile,
  uploadedFileToToolResult,
} from "../multimodal/binary_content.ts";
import {
  buildSchemaPrompt,
  FINAL_RESULT_TOOL,
  isFinalResultTool,
  normaliseSchemas,
  registerOutputTools,
  unionToolIndex,
} from "./output_schema.ts";
import {
  type DeferredToolRequest,
  DeferredToolRequests,
  type DeferredToolResults,
  type ResumeState,
} from "./deferred.ts";

// ---------------------------------------------------------------------------
// Public opts type for execute functions
// ---------------------------------------------------------------------------

/** Internal options passed to executeRun / executeStream. */
export interface InternalRunOpts<TDeps, TOutput> {
  deps: TDeps;
  messageHistory?: ModelMessage[];
  metadata?: Record<string, unknown>;
  /** Per-run usage limits (overrides agent-level limits when set). */
  usageLimits?: UsageLimits;
  /** Per-run model settings (overrides agent-level modelSettings). */
  modelSettings?: ModelSettings;
  /** Per-run end strategy (overrides agent-level endStrategy). */
  endStrategy?: EndStrategy;
  /**
   * Telemetry settings passed to `generateText` / `streamText` as
   * `experimental_telemetry`. Per-run value overrides agent-level setting.
   */
  telemetry?: TelemetrySettings;
  /**
   * Deferred tool results supplied by the caller when resuming after human
   * approval. Injected into message history before the next model turn.
   */
  deferredResults?: DeferredToolResults;
  /**
   * When true, `messageHistory` already contains the full conversation up to
   * the pause point (including the assistant's tool call message). The run
   * does NOT prepend a new user message from `prompt`. Used by `agent.resume()`.
   * @internal
   */
  _resumeFromDeferred?: boolean;
  /**
   * The original pending requests from the deferred tool gate. Passed through
   * from `agent.resume()` so `buildResumeToolMessage` can look up toolNames
   * by toolCallId for accurate tool-result messages.
   * @internal
   */
  _deferredPendingRequests?: ReadonlyArray<DeferredToolRequest>;
  /** Populated by Agent.override(); replaces corresponding agent fields for this run. */
  _override?: {
    model?: LanguageModel;
    systemPrompts?: Array<
      string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
    >;
    instructions?: Array<
      string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
    >;
    tools?: ReadonlyArray<ToolDefinition<TDeps>>;
    toolsets?: ReadonlyArray<Toolset<TDeps>>;
    historyProcessors?: ReadonlyArray<HistoryProcessor<TDeps>>;
    resultValidators?: ReadonlyArray<ResultValidator<TDeps, TOutput>>;
    maxRetries?: number;
    maxTurns?: number;
    usageLimits?: UsageLimits;
    modelSettings?: ModelSettings;
    endStrategy?: EndStrategy;
    telemetry?: TelemetrySettings;
  };
  /** When true, bypasses the ALLOW_MODEL_REQUESTS guard (set by agent.override()). */
  _bypassModelRequestsCheck?: boolean;
}

// ---------------------------------------------------------------------------
// Context / message helpers
// ---------------------------------------------------------------------------

export function createRunContext<TDeps>(
  deps: TDeps,
  metadata: Record<string, unknown>,
): RunContext<TDeps> {
  const toolResultMetadata = new Map<string, Record<string, unknown>>();
  return {
    deps,
    usage: createUsage(),
    retryCount: 0,
    toolName: null,
    runId: globalThis.crypto.randomUUID(),
    metadata,
    toolResultMetadata,
    attachMetadata(toolCallId: string, meta: Record<string, unknown>): void {
      toolResultMetadata.set(toolCallId, { ...meta });
    },
  };
}

async function resolvePromptParts<TDeps>(
  parts: ReadonlyArray<
    string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
  >,
  ctx: RunContext<TDeps>,
): Promise<string | undefined> {
  const resolved: string[] = [];
  for (const p of parts) {
    resolved.push(typeof p === "string" ? p : await p(ctx));
  }
  return resolved.length > 0 ? resolved.join("\n\n") : undefined;
}

export function resolveSystemPrompt<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  ctx: RunContext<TDeps>,
  overrideSystemPrompts?: Array<
    string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
  >,
): Promise<string | undefined> {
  const prompts = overrideSystemPrompts ?? [...agent.systemPrompts];
  return resolvePromptParts(prompts, ctx);
}

/**
 * Resolves instructions for the current turn and combines them with the
 * resolved system prompt. Instructions differ from systemPrompt in that they
 * are resolved per-turn (allowing dynamic per-turn values) and are NOT stored
 * in the message history (they only exist in the `system` field of each call).
 *
 * Also collects per-turn instructions from step-scoped toolsets via their
 * optional `getInstructions` method. Equivalent to Pydantic AI's
 * `_get_instructions` which combines agent instructions with toolset instructions.
 */
export async function resolveSystemWithInstructions<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  ctx: RunContext<TDeps>,
  systemPrompt: string | undefined,
  overrideInstructions?: Array<
    string | ((ctx: RunContext<TDeps>) => string | Promise<string>)
  >,
  stepScopedToolsets?: ReadonlyArray<Toolset<TDeps>>,
): Promise<string | undefined> {
  const instructionParts = overrideInstructions ?? [...agent.instructions];
  const agentInstructions = await resolvePromptParts(instructionParts, ctx);

  // Collect per-turn instructions from each step-scoped toolset.
  const toolsetParts: string[] = [];
  if (stepScopedToolsets) {
    for (const ts of stepScopedToolsets) {
      if (ts.getInstructions) {
        const tsInstr = await ts.getInstructions(ctx);
        if (tsInstr) {
          if (Array.isArray(tsInstr)) {
            toolsetParts.push(...tsInstr.filter((s) => s && s.trim()));
          } else if (tsInstr.trim()) {
            toolsetParts.push(tsInstr);
          }
        }
      }
    }
  }

  const allInstructionParts = [
    ...(agentInstructions ? [agentInstructions] : []),
    ...toolsetParts,
  ];
  const instructions = allInstructionParts.length > 0
    ? allInstructionParts.join("\n\n")
    : undefined;

  if (systemPrompt && instructions) {
    return `${systemPrompt}\n\n${instructions}`;
  }
  return systemPrompt ?? instructions;
}

export function buildInitialMessages(
  messageHistory: ModelMessage[] | undefined,
  prompt: string,
): ModelMessage[] {
  return [...(messageHistory ?? []), { role: "user", content: prompt }];
}

// ---------------------------------------------------------------------------
// Tool resolution - called per-turn to support prepare() and dynamic toolsets
// ---------------------------------------------------------------------------

/**
 * Called once per run before the first model turn. Invokes `forRun` on each
 * toolset to obtain the run-scoped instance. Toolsets that do not implement
 * `forRun` are returned unchanged (the interface default returns `this`).
 *
 * Equivalent to Pydantic AI's `AbstractToolset.for_run`.
 */
export function initToolsetsForRun<TDeps>(
  toolsets: ReadonlyArray<Toolset<TDeps>>,
  ctx: RunContext<TDeps>,
): Promise<Toolset<TDeps>[]> {
  return Promise.all(
    toolsets.map((ts) => ts.forRun ? ts.forRun(ctx) : Promise.resolve(ts)),
  );
}

/**
 * Called at the start of every model turn. Invokes `forRunStep` on each
 * run-scoped toolset to obtain the step-scoped instance. Toolsets that do not
 * implement `forRunStep` are returned unchanged.
 *
 * Equivalent to Pydantic AI's `AbstractToolset.for_run_step`.
 */
function resolveToolsetsForStep<TDeps>(
  toolsets: ReadonlyArray<Toolset<TDeps>>,
  ctx: RunContext<TDeps>,
): Promise<Toolset<TDeps>[]> {
  return Promise.all(
    toolsets.map((ts) =>
      ts.forRunStep ? ts.forRunStep(ctx) : Promise.resolve(ts)
    ),
  );
}

/**
 * Resolves all tools for a single model turn. Calls `prepare()` on each tool
 * to allow dynamic inclusion/exclusion, and flattens toolsets.
 */
export async function resolveTools<TDeps>(
  tools: ReadonlyArray<ToolDefinition<TDeps>>,
  toolsets: ReadonlyArray<Toolset<TDeps>>,
  ctx: RunContext<TDeps>,
): Promise<ToolDefinition<TDeps>[]> {
  const resolved: ToolDefinition<TDeps>[] = [];

  for (const t of tools) {
    if (t.prepare) {
      const prepared = await t.prepare(ctx);
      if (prepared !== null && prepared !== undefined) {
        resolved.push(prepared);
      }
    } else {
      resolved.push(t);
    }
  }

  for (const ts of toolsets) {
    const tsTools = await ts.tools(ctx);
    // Toolset tools also support prepare
    for (const t of tsTools) {
      if (t.prepare) {
        const prepared = await t.prepare(ctx);
        if (prepared !== null && prepared !== undefined) {
          resolved.push(prepared);
        }
      } else {
        resolved.push(t);
      }
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Tool map builder
// ---------------------------------------------------------------------------

// Re-export for callers that depend on these by name.
export {
  FINAL_RESULT_TOOL,
  isFinalResultTool,
  normaliseSchemas,
  unionToolIndex,
};

export function buildResponseMessages(
  responseMessages: ModelMessage[],
  accumulatedText: string,
): ModelMessage[] {
  if (responseMessages.length > 0) return responseMessages;
  if (accumulatedText.length > 0) {
    return [
      {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: accumulatedText }],
      },
    ];
  }
  return [];
}

/**
 * Build an AI SDK ToolSet from resolved tool definitions. Handles output tools
 * by wrapping their execute return to preserve the result, and handles
 * BinaryContent / UploadedFile returns by converting them to appropriate
 * AI SDK content parts.
 *
 * When `outputMode` is `'tool'` and `outputSchema` is provided, registers
 * `final_result` (single schema) or `final_result_N` tools (union schema array).
 * When `outputMode` is `'native'` or `'prompted'`, no final_result tools are
 * registered here.
 *
 * @param resolvedTools - Tool definitions resolved for this turn.
 * @param outputSchema - Optional Zod schema (or array) for structured output.
 * @param outputMode - How structured output is delivered ('tool' | 'native' | 'prompted').
 * @param ctx - The current RunContext.
 * @param maxConcurrency - Optional cap on concurrent tool executions.
 * @param sequentialMutex - Shared mutex for sequential tools.
 */
export function buildToolMap<TDeps>(
  resolvedTools: ToolDefinition<TDeps>[],
  outputSchema:
    | import("zod").ZodType
    | import("zod").ZodType[]
    | import("../multimodal/binary_content.ts").BinaryImageOutputSentinel
    | undefined,
  outputMode: import("../types/output_mode.ts").OutputMode,
  ctx: RunContext<TDeps>,
  maxConcurrency?: number,
  sequentialMutex?: Semaphore,
): ToolSet {
  const toolMap = toAISDKTools(
    resolvedTools,
    () => ctx,
    maxConcurrency,
    sequentialMutex,
  );
  if (outputSchema && outputMode === "tool" && !isBinaryImageOutput(outputSchema)) {
    registerOutputTools(toolMap, outputSchema as import("zod").ZodType | import("zod").ZodType[]);
  }
  return toolMap;
}

export function toolsOrUndefined(toolMap: ToolSet): ToolSet | undefined {
  return Object.keys(toolMap).length > 0 ? toolMap : undefined;
}

// ---------------------------------------------------------------------------
// Output tool detection
// ---------------------------------------------------------------------------

/**
 * Returns the name of the first output tool found in the resolved tools array,
 * or undefined if none exist.
 */
export function findOutputToolNames<TDeps>(
  resolvedTools: ToolDefinition<TDeps>[],
): Set<string> {
  const names = new Set<string>();
  for (const t of resolvedTools) {
    if (t.isOutput) names.add(t.name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// BinaryContent / UploadedFile tool result conversion
// ---------------------------------------------------------------------------

/**
 * Serialize a tool execute return value to a form the AI SDK will accept in
 * a tool-result message. BinaryContent becomes a base64 data-URI string;
 * UploadedFile becomes a file-reference string; everything else passes through.
 */
export function serializeToolResult(value: unknown): unknown {
  if (isBinaryContent(value)) {
    return binaryContentToToolResult(value);
  }
  if (isUploadedFile(value)) {
    return uploadedFileToToolResult(value);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Usage helper
// ---------------------------------------------------------------------------

export function applyUsage(usage: Usage, reported: LanguageModelUsage): void {
  usage.inputTokens += reported.inputTokens ?? 0;
  usage.outputTokens += reported.outputTokens ?? 0;
  usage.totalTokens += reported.totalTokens ?? 0;
  usage.requests += 1;
}

// ---------------------------------------------------------------------------
// Result validator runner
// ---------------------------------------------------------------------------

export async function runValidators<TDeps, TOutput>(
  validators: ReadonlyArray<ResultValidator<TDeps, TOutput>>,
  ctx: RunContext<TDeps>,
  output: TOutput,
): Promise<TOutput> {
  let result = output;
  for (const v of validators) {
    result = await v(ctx, result);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Nudge helpers - push a retry user message and throw if retries exhausted
// ---------------------------------------------------------------------------

export function nudgeForFinalResult<TDeps>(
  ctx: RunContext<TDeps>,
  messages: ModelMessage[],
  maxRetries: number,
): void {
  if (ctx.retryCount >= maxRetries) throw new MaxRetriesError(maxRetries);
  ctx.retryCount++;
  messages.push({
    role: "user",
    content:
      `Please use the \`${FINAL_RESULT_TOOL}\` tool to return your answer in the required format.`,
  });
}

export function nudgeWithValidationError<TDeps>(
  ctx: RunContext<TDeps>,
  messages: ModelMessage[],
  maxRetries: number,
  error: Error,
): void {
  if (ctx.retryCount >= maxRetries) {
    throw new MaxRetriesError(maxRetries, error);
  }
  ctx.retryCount++;
  messages.push({
    role: "user",
    content: `Result validation failed: ${error.message}. Please try again.`,
  });
}

// ---------------------------------------------------------------------------
// Pre-turn setup helper - runs limits check, resolves tools, applies processors
// ---------------------------------------------------------------------------

export interface TurnSetup<TDeps> {
  toolMap: ToolSet;
  tools: ToolSet | undefined;
  msgsForModel: ModelMessage[];
  /** System prompt combined with per-turn instructions. */
  system: string | undefined;
  /** Names of output tools resolved for this turn. */
  outputToolNames: Set<string>;
  /** Resolved tool definitions (used for output tool detection). */
  resolvedTools: ToolDefinition<TDeps>[];
}

export async function prepareTurn<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  opts: InternalRunOpts<TDeps, TOutput>,
  ctx: RunContext<TDeps>,
  messages: ModelMessage[],
  /** The resolved system prompt (without instructions) from run start. */
  systemPrompt: string | undefined,
  /** Shared mutex for sequential tools (created once per run). */
  sequentialMutex?: Semaphore,
  /**
   * Run-scoped toolsets returned by `initToolsetsForRun`. When provided,
   * `forRunStep` is called on each to obtain the step-scoped instance before
   * resolving tools. When omitted the raw toolsets from `opts`/`agent` are
   * used directly (backward-compatible path).
   */
  runScopedToolsets?: ReadonlyArray<Toolset<TDeps>>,
): Promise<TurnSetup<TDeps>> {
  // Check usage limits (agent-level, then per-run override)
  const limits = opts._override?.usageLimits ?? opts.usageLimits ??
    agent.usageLimits;
  if (limits) checkUsageLimits(limits, ctx.usage);

  const tools = opts._override?.tools ?? agent.tools;
  // If run-scoped toolsets were provided, apply forRunStep for this step;
  // otherwise fall back to toolsets from opts/agent (no lifecycle hooks).
  const toolsets = runScopedToolsets
    ? await resolveToolsetsForStep(runScopedToolsets, ctx)
    : (opts._override?.toolsets ?? agent.toolsets);
  const resolvedTools = await resolveTools(tools, toolsets, ctx);
  const outputToolNames = findOutputToolNames(resolvedTools);
  const toolMap = buildToolMap(
    resolvedTools,
    agent.outputSchema,
    agent.outputMode,
    ctx,
    agent.maxConcurrency,
    sequentialMutex,
  );

  const historyProcessors = opts._override?.historyProcessors ??
    agent.historyProcessors;
  const msgsForModel = await applyHistoryProcessors(
    historyProcessors,
    messages,
    ctx,
  );

  // Resolve per-turn instructions and combine with system prompt.
  // For 'prompted' mode with outputTemplate enabled, append the schema prompt.
  let baseSystem = await resolveSystemWithInstructions(
    agent,
    ctx,
    systemPrompt,
    opts._override?.instructions,
    toolsets,
  );

  if (
    agent.outputMode === "prompted" &&
    agent.outputTemplate !== false &&
    agent.outputSchema &&
    !isBinaryImageOutput(agent.outputSchema)
  ) {
    const schemaPrompt = buildSchemaPrompt(agent.outputSchema as import("zod").ZodType | import("zod").ZodType[]);
    baseSystem = baseSystem ? `${baseSystem}\n\n${schemaPrompt}` : schemaPrompt;
  }

  const system = baseSystem;

  // Notify capture store
  _notifyModelRequest(msgsForModel);

  return {
    toolMap,
    tools: toolsOrUndefined(toolMap),
    msgsForModel,
    system,
    outputToolNames,
    resolvedTools,
  };
}

/** Resolve effective model settings, merging agent-level with run/override-level. */
export function resolveModelSettings<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  opts: InternalRunOpts<TDeps, TOutput>,
): ModelSettings {
  // Override-level > run-level > agent-level (spread, so later keys win)
  return {
    ...(agent.modelSettings ?? {}),
    ...(opts.modelSettings ?? {}),
    ...(opts._override?.modelSettings ?? {}),
  };
}

/**
 * Convert a `ModelSettings` object to the options expected by AI SDK v6's
 * `generateText` / `streamText`. Notably, `maxTokens` maps to `maxOutputTokens`.
 */
export function modelSettingsToAISDKOptions(
  settings: ModelSettings,
): Record<string, unknown> {
  const {
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    seed,
  } = settings;
  const result: Record<string, unknown> = {};
  if (temperature !== undefined) result.temperature = temperature;
  if (maxTokens !== undefined) result.maxOutputTokens = maxTokens;
  if (topP !== undefined) result.topP = topP;
  if (topK !== undefined) result.topK = topK;
  if (frequencyPenalty !== undefined) {
    result.frequencyPenalty = frequencyPenalty;
  }
  if (presencePenalty !== undefined) result.presencePenalty = presencePenalty;
  if (stopSequences !== undefined) result.stopSequences = stopSequences;
  if (seed !== undefined) result.seed = seed;
  return result;
}

/** Resolve effective end strategy. */
export function resolveEndStrategy<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  opts: InternalRunOpts<TDeps, TOutput>,
): import("../agent.ts").EndStrategy {
  return opts._override?.endStrategy ?? opts.endStrategy ?? agent.endStrategy;
}

/**
 * Resolve effective telemetry settings.
 *
 * Priority: override-level > per-run level > agent-level.
 * Returns `undefined` if none are configured.
 */
export function resolveTelemetry<TDeps, TOutput>(
  agent: Agent<TDeps, TOutput>,
  opts: InternalRunOpts<TDeps, TOutput>,
): TelemetrySettings | undefined {
  return opts._override?.telemetry ?? opts.telemetry ?? agent.telemetry;
}

// ---------------------------------------------------------------------------
// Sequential mutex factory
// ---------------------------------------------------------------------------

/**
 * Create a shared mutex (1-permit Semaphore) for sequential tool execution.
 * Used once per run and shared across all turns.
 */
export function createSequentialMutex(): Semaphore {
  return new Semaphore(1);
}

// ---------------------------------------------------------------------------
// Model request guard
// ---------------------------------------------------------------------------

export function checkModelRequestsAllowed(bypass = false): void {
  assertModelRequestsAllowed(bypass);
}

// ---------------------------------------------------------------------------
// Deferred tools support
// ---------------------------------------------------------------------------

/**
 * Check whether a tool requires approval for the given context and args.
 * Evaluates static booleans or calls the predicate function.
 */
export async function checkRequiresApproval<TDeps>(
  t: ToolDefinition<TDeps>,
  ctx: RunContext<TDeps>,
  args: Record<string, unknown>,
): Promise<boolean> {
  const flag = t.requiresApproval;
  if (flag === undefined || flag === false) return false;
  if (flag === true) return true;
  return await flag(ctx, args);
}

/**
 * Build an AI SDK ToolSet where approval-required tools record themselves into
 * `pendingApprovals` instead of executing. Normal tools execute as usual.
 *
 * After `generateText` completes, check `pendingApprovals`. If non-empty,
 * call `correlateApprovalIds` to attach the real toolCallIds from the response,
 * then throw `ApprovalRequiredError` with a `DeferredToolRequests` instance.
 *
 * @param tools - All resolved tool definitions for this turn.
 * @param outputSchema - Optional Zod schema for output tools.
 * @param outputMode - Output delivery mode.
 * @param ctx - The current RunContext.
 * @param pendingApprovals - Mutable array; approval-required calls are pushed here.
 * @param maxConcurrency - Optional concurrency cap.
 * @param sequentialMutex - Shared mutex for sequential tools.
 */
export function buildDeferredAwareToolMap<TDeps>(
  tools: ReadonlyArray<ToolDefinition<TDeps>>,
  outputSchema:
    | import("zod").ZodType
    | import("zod").ZodType[]
    | import("../multimodal/binary_content.ts").BinaryImageOutputSentinel
    | undefined,
  outputMode: import("../types/output_mode.ts").OutputMode,
  ctx: RunContext<TDeps>,
  pendingApprovals: DeferredToolRequest[],
  maxConcurrency?: number,
  sequentialMutex?: Semaphore,
): ToolSet {
  // Wrap approval-required tools so they record instead of execute.
  // We intercept in the execute by checking requiresApproval at call time.
  // The toolCallId is not available here (it's in the AI SDK's execute options),
  // so we use a sentinel and correlate IDs after generateText via correlateApprovalIds.
  const wrappedTools: ToolDefinition<TDeps>[] = tools.map((t) => {
    if (!t.requiresApproval) return t;
    const wrapped: ToolDefinition<TDeps> = {
      ...t,
      execute: async (
        execCtx: RunContext<TDeps>,
        args: import("zod").infer<import("zod").ZodType>,
      ) => {
        const argsRecord = args as Record<string, unknown>;
        const needsApproval = await checkRequiresApproval(
          t,
          execCtx,
          argsRecord,
        );
        if (!needsApproval) {
          // Dynamic predicate returned false - run original execute
          return t.execute(execCtx, args);
        }
        // Record this call; toolCallId will be filled in by correlateApprovalIds
        pendingApprovals.push({
          toolCallId: `__pending_${pendingApprovals.length}__`,
          toolName: t.name,
          args: argsRecord,
        });
        // Placeholder result - discarded when we throw ApprovalRequiredError
        return `__approval_required__`;
      },
    };
    return wrapped;
  });

  const toolMap = toAISDKTools(
    wrappedTools,
    () => ctx,
    maxConcurrency,
    sequentialMutex,
  );
  if (outputSchema && outputMode === "tool" && !isBinaryImageOutput(outputSchema)) {
    registerOutputTools(toolMap, outputSchema as import("zod").ZodType | import("zod").ZodType[]);
  }
  return toolMap;
}

/**
 * After `generateText` returns, correlate pending approval records with the
 * actual tool calls from the response to fill in real toolCallIds.
 *
 * Matches by tool name in order of appearance in `toolCalls`.
 */
export function correlateApprovalIds(
  pendingApprovals: DeferredToolRequest[],
  toolCalls: ReadonlyArray<{ toolCallId: string; toolName: string }>,
): void {
  // Build a queue of call IDs per tool name, in order they appear
  const idQueueByName = new Map<string, string[]>();
  for (const tc of toolCalls) {
    const q = idQueueByName.get(tc.toolName) ?? [];
    q.push(tc.toolCallId);
    idQueueByName.set(tc.toolName, q);
  }

  // Match each pending approval to the next ID for its tool name
  const consumedByName = new Map<string, number>();
  for (const req of pendingApprovals) {
    const queue = idQueueByName.get(req.toolName) ?? [];
    const consumed = consumedByName.get(req.toolName) ?? 0;
    if (consumed < queue.length) {
      req.toolCallId = queue[consumed];
      consumedByName.set(req.toolName, consumed + 1);
    }
  }
}

/**
 * Re-execute a tool with overridden args (for the argsOverride case in resume).
 * Returns the serialized result.
 */
export async function reExecuteTool<TDeps>(
  toolName: string,
  overrideArgs: Record<string, unknown>,
  tools: ReadonlyArray<ToolDefinition<TDeps>>,
  ctx: RunContext<TDeps>,
): Promise<unknown> {
  const t = tools.find((tool) => tool.name === toolName);
  if (!t) {
    return `Error: tool "${toolName}" not found for re-execution`;
  }
  try {
    const rawResult = await t.execute(ctx, overrideArgs);
    return serializeToolResult(rawResult);
  } catch (err) {
    return `Error re-executing tool: ${
      err instanceof Error ? err.message : String(err)
    }`;
  }
}

/**
 * Build the tool-result message that injects approved results into the message
 * history, enabling the run to continue after human approval.
 *
 * For results with `argsOverride`, the tool is re-executed with the new args.
 * For plain `result`, the value is injected directly.
 *
 * @param deferredResults - Human-approved results for each pending tool call.
 * @param pendingRequests - The original deferred requests (provides toolName lookup).
 * @param tools - Resolved tool definitions (needed for argsOverride re-execution).
 * @param ctx - The current RunContext.
 * @returns AI SDK-compatible tool-result message to append to message history.
 */
export async function buildResumeToolMessage<TDeps>(
  deferredResults: DeferredToolResults,
  pendingRequests: ReadonlyArray<DeferredToolRequest>,
  tools: ReadonlyArray<ToolDefinition<TDeps>>,
  ctx: RunContext<TDeps>,
): Promise<ModelMessage> {
  const requestByCallId = new Map<string, DeferredToolRequest>();
  for (const req of pendingRequests) {
    requestByCallId.set(req.toolCallId, req);
  }

  const parts: Array<{
    type: "tool-result";
    toolCallId: string;
    toolName: string;
    output: unknown;
  }> = [];

  for (const dr of deferredResults.results) {
    const req = requestByCallId.get(dr.toolCallId);
    const toolName = req?.toolName ?? dr.toolCallId;
    let output: unknown;

    if (dr.argsOverride !== undefined && req !== undefined) {
      output = await reExecuteTool(toolName, dr.argsOverride, tools, ctx);
    } else {
      output = dr.result ?? "";
    }

    // AI SDK v6 requires output to be ToolResultOutput: { type: "text" | "json", value }
    const formattedOutput: { type: "text"; value: string } | {
      type: "json";
      value: unknown;
    } = typeof output === "string"
      ? { type: "text" as const, value: output }
      : { type: "json" as const, value: output };

    parts.push({
      type: "tool-result" as const,
      toolCallId: dr.toolCallId,
      toolName,
      output: formattedOutput,
    });
  }

  return {
    role: "tool" as const,
    content: parts,
  } as unknown as ModelMessage;
}

/**
 * Strip tool-result messages for deferred tool calls from `responseMessages`.
 *
 * When the AI SDK executes tools and encounters a deferred (approval-required)
 * tool, it records a placeholder tool-result in the response messages. For the
 * resume state we only want to store the conversation up to the assistant's
 * tool-call message - NOT the placeholder results (which will be replaced by
 * the approved results when the run is resumed).
 *
 * @param responseMessages - Messages from `response.response.messages`.
 * @param pendingCallIds - Set of toolCallIds for pending deferred calls.
 * @returns A new array with tool-result messages for deferred calls removed.
 */
export function stripDeferredToolResults(
  responseMessages: ModelMessage[],
  pendingCallIds: ReadonlyArray<string>,
): ModelMessage[] {
  const pendingSet = new Set(pendingCallIds);
  // Filter out tool-result messages that contain only deferred tool results.
  // A tool message may have multiple content parts; we strip any that are
  // deferred and rebuild the message if it still has non-deferred parts.
  return responseMessages.filter((msg) => {
    if (msg.role !== "tool") return true;
    const parts =
      (msg as { role: "tool"; content: Array<{ toolCallId: string }> }).content;
    // Keep this message only if it has at least one non-deferred tool result
    const nonDeferred = parts.filter((p) => !pendingSet.has(p.toolCallId));
    return nonDeferred.length > 0;
  });
}

// Re-export deferred types for run.ts
export { DeferredToolRequests };
export type { DeferredToolRequest, DeferredToolResults, ResumeState };

// ---------------------------------------------------------------------------
// Re-exported helpers for run.ts / stream.ts
// ---------------------------------------------------------------------------

export { applyHistoryProcessors, checkUsageLimits };
export { buildSchemaPrompt, parseTextOutput } from "./output_schema.ts";
