import type { z, ZodType } from "zod";
import { jsonSchema as aiJsonSchema, tool as aiTool, type ToolSet } from "ai";
import type { RunContext } from "./types/context.ts";
import { Semaphore } from "./concurrency.ts";
import type {
  BinaryContent,
  UploadedFile,
} from "./multimodal/binary_content.ts";
import {
  binaryContentToToolResult,
  isBinaryContent,
  isUploadedFile,
  uploadedFileToToolResult,
} from "./multimodal/binary_content.ts";

/** All possible return types from a tool's execute function. */
export type ToolExecuteReturn = string | object | BinaryContent | UploadedFile;

export interface ToolDefinition<TDeps = undefined> {
  name: string;
  description: string;
  parameters: ZodType;
  execute: (
    ctx: RunContext<TDeps>,
    args: z.infer<ZodType>,
  ) => Promise<ToolExecuteReturn>;
  /** Max times to retry this tool on failure before propagating the error. */
  maxRetries?: number;
  /**
   * Cross-field validation run before `execute`. Throw to reject the args and
   * surface an error without consuming a retry.
   */
  argsValidator?: (args: z.infer<ZodType>) => void | Promise<void>;
  /**
   * Called once per model turn before the tools are sent to the model.
   * Return the (possibly modified) tool definition to include it, or
   * `null`/`undefined` to exclude it from this turn.
   */
  prepare?: (
    ctx: RunContext<TDeps>,
  ) =>
    | ToolDefinition<TDeps>
    | null
    | undefined
    | Promise<ToolDefinition<TDeps> | null | undefined>;
  /**
   * When true, calling this tool ends the run - the tool's return value
   * becomes the final run output. Equivalent to Pydantic AI's output tools.
   */
  isOutput?: boolean;
  /**
   * When true, this tool acquires a run-level exclusive mutex during
   * execution so that no two sequential tools run concurrently. Non-sequential
   * tools are not affected.
   */
  sequential?: boolean;
  /**
   * When set, the tool requires human approval before execution.
   *
   * - `true`: Always requires approval.
   * - A function: Called with the run context and proposed args. Return `true`
   *   to require approval, `false` to proceed without it.
   *
   * When approval is required, `agent.run()` throws an `ApprovalRequiredError`
   * containing a `DeferredToolRequests` object. The caller resolves the
   * requests and calls `agent.resume(deferred, results)` to continue.
   */
  requiresApproval?:
    | boolean
    | ((
      ctx: RunContext<TDeps>,
      args: Record<string, unknown>,
    ) => boolean | Promise<boolean>);
}

/**
 * Define a typed tool with Zod parameter validation.
 *
 * @example
 * ```ts
 * const search = tool<MyDeps, typeof SearchParams>({
 *   name: "search",
 *   description: "Search the web",
 *   parameters: z.object({ query: z.string() }),
 *   execute: async (ctx, args) => fetchResults(args.query),
 * });
 * ```
 */
export function tool<
  TDeps = undefined,
  TParams extends ZodType = ZodType,
>(opts: {
  name: string;
  description: string;
  parameters: TParams;
  execute: (
    ctx: RunContext<TDeps>,
    args: z.infer<TParams>,
  ) => Promise<ToolExecuteReturn>;
  maxRetries?: number;
  argsValidator?: (args: z.infer<TParams>) => void | Promise<void>;
  prepare?: (
    ctx: RunContext<TDeps>,
  ) =>
    | ToolDefinition<TDeps>
    | null
    | undefined
    | Promise<ToolDefinition<TDeps> | null | undefined>;
  isOutput?: boolean;
  sequential?: boolean;
  requiresApproval?:
    | boolean
    | ((
      ctx: RunContext<TDeps>,
      args: Record<string, unknown>,
    ) => boolean | Promise<boolean>);
}): ToolDefinition<TDeps> {
  return opts as ToolDefinition<TDeps>;
}

/**
 * Define a tool that does not need the `RunContext`. Simpler signature when
 * your tool has no dependency injection requirements.
 * Equivalent to Pydantic AI's `@agent.tool_plain`.
 *
 * @example
 * ```ts
 * const add = plainTool({
 *   name: "add",
 *   description: "Add two numbers",
 *   parameters: z.object({ a: z.number(), b: z.number() }),
 *   execute: async ({ a, b }) => String(a + b),
 * });
 * ```
 */
export function plainTool<TParams extends ZodType = ZodType>(opts: {
  name: string;
  description: string;
  parameters: TParams;
  execute: (args: z.infer<TParams>) => Promise<ToolExecuteReturn>;
  maxRetries?: number;
  argsValidator?: (args: z.infer<TParams>) => void | Promise<void>;
}): ToolDefinition<undefined> {
  return {
    name: opts.name,
    description: opts.description,
    parameters: opts.parameters,
    maxRetries: opts.maxRetries,
    argsValidator: opts.argsValidator
      ? (args: z.infer<ZodType>) =>
        opts.argsValidator!(args as z.infer<TParams>)
      : undefined,
    execute: (_ctx, args: z.infer<ZodType>) =>
      opts.execute(args as z.infer<TParams>),
  };
}

/**
 * Build a tool from a raw JSON Schema object instead of a Zod schema.
 * Useful when integrating with external schema registries or OpenAPI specs.
 *
 * @example
 * ```ts
 * const search = fromSchema({
 *   name: "search",
 *   description: "Search documents",
 *   jsonSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
 *   execute: async (ctx, args) => doSearch(args.query as string),
 * });
 * ```
 */
export function fromSchema<TDeps = undefined>(opts: {
  name: string;
  description: string;
  jsonSchema: Record<string, unknown>;
  execute: (
    ctx: RunContext<TDeps>,
    args: Record<string, unknown>,
  ) => Promise<ToolExecuteReturn>;
  maxRetries?: number;
}): ToolDefinition<TDeps> {
  // Wrap the raw JSON schema with the AI SDK helper so it satisfies ZodType-like interface
  const wrappedSchema = aiJsonSchema(opts.jsonSchema) as unknown as ZodType;
  return {
    name: opts.name,
    description: opts.description,
    parameters: wrappedSchema,
    maxRetries: opts.maxRetries,
    execute: (ctx: RunContext<TDeps>, args: z.infer<ZodType>) =>
      opts.execute(ctx, args as Record<string, unknown>),
  };
}

/**
 * Define an output tool - when the model calls this tool, its return value
 * becomes the final run output and the run ends immediately.
 * Equivalent to Pydantic AI's output tools / `final_result` pattern.
 *
 * @example
 * ```ts
 * const done = outputTool({
 *   name: "done",
 *   description: "Return the final answer",
 *   parameters: z.object({ answer: z.string() }),
 *   execute: async (ctx, args) => args.answer,
 * });
 * ```
 */
export function outputTool<
  TDeps = undefined,
  TParams extends ZodType = ZodType,
>(opts: {
  name: string;
  description: string;
  parameters: TParams;
  execute: (
    ctx: RunContext<TDeps>,
    args: z.infer<TParams>,
  ) => Promise<string | object>;
}): ToolDefinition<TDeps> {
  return {
    name: opts.name,
    description: opts.description,
    parameters: opts.parameters,
    isOutput: true,
    execute: (ctx: RunContext<TDeps>, args: z.infer<ZodType>) =>
      opts.execute(ctx, args as z.infer<TParams>),
  };
}

// ---------------------------------------------------------------------------
// toAISDKTools - internal conversion used by the run loop
// ---------------------------------------------------------------------------

/**
 * Convert our ToolDefinition array into the format expected by Vercel AI SDK's
 * generateText/streamText `tools` option. Execution is wired through the provided
 * RunContext so tools have access to deps, usage, etc.
 *
 * @param tools - Tool definitions to convert.
 * @param getCtx - Factory that returns the current RunContext.
 * @param maxConcurrency - Optional cap on concurrent tool executions per turn.
 * @param sequentialMutex - Optional shared mutex for sequential tools.
 */
export function toAISDKTools<TDeps>(
  tools: ReadonlyArray<ToolDefinition<TDeps>>,
  getCtx: () => RunContext<TDeps>,
  maxConcurrency?: number,
  sequentialMutex?: Semaphore,
): ToolSet {
  const semaphore = maxConcurrency !== undefined
    ? new Semaphore(maxConcurrency)
    : undefined;

  const result: ToolSet = {};
  for (const t of tools) {
    result[t.name] = aiTool({
      description: t.description,
      inputSchema: t.parameters,
      execute: (args: z.infer<ZodType>) => {
        const run = async () => {
          const ctx = getCtx();
          const prev = ctx.toolName;
          ctx.toolName = t.name;
          const attempts = (t.maxRetries ?? 0) + 1;
          let lastErr: unknown;
          try {
            if (t.argsValidator) {
              await t.argsValidator(args);
            }
            for (let i = 0; i < attempts; i++) {
              try {
                const rawResult = await t.execute(ctx, args);
                // Convert multi-modal returns to AI SDK-compatible formats
                if (isBinaryContent(rawResult)) {
                  return binaryContentToToolResult(rawResult);
                }
                if (isUploadedFile(rawResult)) {
                  return uploadedFileToToolResult(rawResult);
                }
                return rawResult;
              } catch (err) {
                lastErr = err;
              }
            }
            throw lastErr;
          } finally {
            ctx.toolName = prev;
          }
        };

        // Sequential tool - acquire the run-level mutex
        const withSequential = t.sequential && sequentialMutex !== undefined
          ? () => sequentialMutex.run(run)
          : run;

        return semaphore !== undefined
          ? semaphore.run(withSequential)
          : withSequential();
      },
    });
  }
  return result;
}
