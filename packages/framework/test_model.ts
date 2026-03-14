/**
 * TestModel — a schema-aware mock language model for testing.
 *
 * Automatically generates valid responses based on the tools and output schema
 * provided in each `doGenerate` call:
 *
 * - Turn 1: Calls every non-`final_result` tool once (in order) with
 *   schema-valid args derived from JSON Schema / Zod introspection.
 * - Turn 2 (or turn 1 when `callTools` is false): Calls `final_result` with
 *   schema-valid data, or returns plain text when no output schema is present.
 *
 * @example
 * ```ts
 * const model = new TestModel();
 * const result = await agent.override({ model }).run("Hello");
 * ```
 */

import type { MockLanguageModelV3 } from "ai/test";
import type { ZodTypeAny } from "zod";

// ---------------------------------------------------------------------------
// Types derived from MockLanguageModelV3 to stay version-compatible
// ---------------------------------------------------------------------------

/** The generate result shape, derived from MockLanguageModelV3. */
export type DoGenerateResult = Awaited<
  ReturnType<MockLanguageModelV3["doGenerate"]>
>;

/** doGenerate parameters shape, derived from MockLanguageModelV3. */
type DoGenerateParams = Parameters<MockLanguageModelV3["doGenerate"]>[0];

/** A single tool entry from the doGenerate call. */
type ToolEntry = NonNullable<DoGenerateParams["tools"]>[number];

/** A function-type tool (as opposed to provider-defined tools). */
type FunctionTool = Extract<ToolEntry, { type: "function" }>;

// ---------------------------------------------------------------------------
// TestModel options
// ---------------------------------------------------------------------------

export interface TestModelOptions {
  /** When true (default), call all non-final_result tools before final_result. */
  callTools?: boolean;
  /** Text to return when no outputSchema tool is present. */
  text?: string;
}

// ---------------------------------------------------------------------------
// JSON Schema value generation
// ---------------------------------------------------------------------------

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  default?: unknown;
};

/**
 * Generate a schema-valid value from a JSON Schema object.
 * Used to build test args/inputs for tool calls and `final_result`.
 */
function generateFromJsonSchema(schema: JsonSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  if (schema.default !== undefined) return schema.default;

  if (schema.anyOf && schema.anyOf.length > 0) {
    return generateFromJsonSchema(schema.anyOf[0]);
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return generateFromJsonSchema(schema.oneOf[0]);
  }
  if (schema.allOf && schema.allOf.length > 0) {
    const merged: Record<string, unknown> = {};
    for (const branch of schema.allOf) {
      const val = generateFromJsonSchema(branch);
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        Object.assign(merged, val);
      }
    }
    return merged;
  }

  switch (schema.type) {
    case "string":
      return "test";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "null":
      return null;
    case "array":
      return [];
    case "object": {
      const result: Record<string, unknown> = {};
      const required = new Set(schema.required ?? []);
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        if (required.has(key)) {
          result[key] = generateFromJsonSchema(propSchema);
        }
      }
      return result;
    }
    default:
      return {};
  }
}

/**
 * Generate a schema-valid value from a Zod type using its internal `_def`.
 * Provides more semantically correct values (enums pick first member, literals
 * return the exact value, etc.).
 */
function generateFromZodDef(zodType: ZodTypeAny): unknown {
  const def = (zodType as unknown as { _def: Record<string, unknown> })._def;
  if (!def) return "test";

  const type = def["type"] as string | undefined;

  switch (type) {
    case "string":
      return "test";
    case "number":
    case "float":
    case "int":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "null":
      return null;
    case "undefined":
      return undefined;
    case "array":
      return [];
    case "literal": {
      const values = def["values"] as unknown[] | undefined;
      return values && values.length > 0 ? values[0] : "test";
    }
    case "enum": {
      const entries = def["entries"] as Record<string, unknown> | undefined;
      if (entries) {
        const first = Object.values(entries)[0];
        if (first !== undefined) return first;
      }
      return "test";
    }
    case "optional": {
      // Skip optional fields — return undefined so callers can omit them
      return undefined;
    }
    case "nullable": {
      const inner = def["innerType"] as ZodTypeAny | undefined;
      return inner ? generateFromZodDef(inner) : null;
    }
    case "default": {
      const defaultValue = def["defaultValue"] as (() => unknown) | unknown;
      if (typeof defaultValue === "function") {
        return (defaultValue as () => unknown)();
      }
      return defaultValue;
    }
    case "object": {
      const shape = def["shape"] as
        | Record<string, ZodTypeAny>
        | (() => Record<string, ZodTypeAny>)
        | undefined;
      const resolvedShape = typeof shape === "function" ? shape() : shape;
      if (!resolvedShape) return {};
      const result: Record<string, unknown> = {};
      for (const [key, fieldSchema] of Object.entries(resolvedShape)) {
        const val = generateFromZodDef(fieldSchema);
        if (val !== undefined) {
          result[key] = val;
        }
      }
      return result;
    }
    case "union": {
      const options = def["options"] as ZodTypeAny[] | undefined;
      if (options && options.length > 0) return generateFromZodDef(options[0]);
      return "test";
    }
    case "intersection": {
      const left = def["left"] as ZodTypeAny | undefined;
      const right = def["right"] as ZodTypeAny | undefined;
      const leftVal = left ? generateFromZodDef(left) : {};
      const rightVal = right ? generateFromZodDef(right) : {};
      if (
        typeof leftVal === "object" && typeof rightVal === "object" &&
        leftVal !== null && rightVal !== null &&
        !Array.isArray(leftVal) && !Array.isArray(rightVal)
      ) {
        return { ...leftVal as object, ...rightVal as object };
      }
      return leftVal;
    }
    case "tuple": {
      const items = def["items"] as ZodTypeAny[] | undefined;
      return items ? items.map(generateFromZodDef) : [];
    }
    case "record":
    case "map":
      return {};
    case "set":
      return [];
    case "pipe":
    case "transform": {
      const inner = def["innerType"] as ZodTypeAny | undefined;
      return inner ? generateFromZodDef(inner) : "test";
    }
    case "catch": {
      return def["catchValue"] ?? "test";
    }
    default:
      return "test";
  }
}

/**
 * Generate a schema-valid value from a tool's `inputSchema` (JSON Schema).
 * Returns an object suitable for use as tool call arguments.
 */
function generateArgsFromInputSchema(
  inputSchema: unknown,
): Record<string, unknown> {
  if (typeof inputSchema !== "object" || inputSchema === null) return {};
  const result = generateFromJsonSchema(inputSchema as JsonSchema);
  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUsage(): DoGenerateResult["usage"] {
  return {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: undefined },
    outputTokens: { total: 1, text: undefined, reasoning: undefined },
  };
}

let _toolCallCounter = 0;

function nextToolCallId(): string {
  return `test-tc-${++_toolCallCounter}`;
}

function buildToolCallContent(
  tools: FunctionTool[],
): DoGenerateResult["content"] {
  return tools.map((t) => ({
    type: "tool-call" as const,
    toolCallId: nextToolCallId(),
    toolName: t.name,
    input: JSON.stringify(generateArgsFromInputSchema(t.inputSchema)),
  }));
}

function buildFinalResultContent(
  tool: FunctionTool,
  schema?: ZodTypeAny,
): DoGenerateResult["content"] {
  const args = schema
    ? generateFromZodDef(schema)
    : generateArgsFromInputSchema(tool.inputSchema);
  return [
    {
      type: "tool-call" as const,
      toolCallId: nextToolCallId(),
      toolName: "final_result",
      input: JSON.stringify(args),
    },
  ];
}

// ---------------------------------------------------------------------------
// TestModel
// ---------------------------------------------------------------------------

export class TestModel {
  readonly specificationVersion = "v3" as const;
  readonly provider = "test-model";
  readonly modelId = "test-model";
  readonly supportedUrls: Record<string, RegExp[]> = {};

  private readonly _callTools: boolean;
  private readonly _text: string;
  private readonly _outputSchema: ZodTypeAny | undefined;
  private _turn: number;

  constructor(options?: TestModelOptions & { outputSchema?: ZodTypeAny }) {
    this._callTools = options?.callTools ?? true;
    this._text = options?.text ?? "test response";
    this._outputSchema = options?.outputSchema;
    this._turn = 0;
  }

  doGenerate(options: DoGenerateParams): Promise<DoGenerateResult> {
    this._turn += 1;
    const currentTurn = this._turn;

    const allTools = (options.tools ?? []) as ToolEntry[];
    const functionTools = allTools.filter(
      (t: ToolEntry): t is FunctionTool => t.type === "function",
    );

    const finalResultTool = functionTools.find(
      (t: FunctionTool) => t.name === "final_result",
    );
    const regularTools = functionTools.filter(
      (t: FunctionTool) => t.name !== "final_result",
    );

    // Turn 1 with callTools=true: invoke all regular tools before final_result
    if (this._callTools && currentTurn === 1 && regularTools.length > 0) {
      return Promise.resolve({
        content: buildToolCallContent(regularTools),
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage: makeUsage(),
        warnings: [],
      });
    }

    // Call final_result if present
    if (finalResultTool) {
      return Promise.resolve({
        content: buildFinalResultContent(finalResultTool, this._outputSchema),
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage: makeUsage(),
        warnings: [],
      });
    }

    // Text response when no output schema
    return Promise.resolve({
      content: [{ type: "text" as const, text: this._text }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: makeUsage(),
      warnings: [],
    });
  }

  doStream(
    options: DoGenerateParams,
  ): Promise<Awaited<ReturnType<MockLanguageModelV3["doStream"]>>> {
    return this.doGenerate(options).then((result) => {
      const chunks: unknown[] = [];

      for (const part of result.content) {
        if (part.type === "text") {
          chunks.push({
            type: "text-delta" as const,
            id: "text-1",
            delta: part.text,
          });
        } else if (part.type === "tool-call") {
          chunks.push({
            type: "tool-call" as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          });
        }
      }

      chunks.push({
        type: "finish" as const,
        finishReason: result.finishReason,
        usage: result.usage,
      });

      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      return { stream };
    });
  }
}

// ---------------------------------------------------------------------------
// createTestModel — convenience factory
// ---------------------------------------------------------------------------

/**
 * Create a TestModel, optionally providing a Zod output schema for more
 * accurate `final_result` generation.
 *
 * @example
 * ```ts
 * const OutputSchema = z.object({ answer: z.string() });
 * const model = createTestModel({ outputSchema: OutputSchema });
 * const result = await agent.override({ model }).run("Hello");
 * ```
 */
export function createTestModel(
  options?: TestModelOptions & { outputSchema?: ZodTypeAny },
): TestModel {
  return new TestModel(options);
}
