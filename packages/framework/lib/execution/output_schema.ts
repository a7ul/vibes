/**
 * Helpers for working with output schemas: union registration, JSON schema
 * extraction, and system-prompt injection.
 */
import { tool as aiTool } from "ai";
import type { ToolSet } from "ai";
import type { ZodTypeAny } from "zod";

// ---------------------------------------------------------------------------
// Naming conventions
// ---------------------------------------------------------------------------

/** Tool name for a single-schema final_result tool. */
export const FINAL_RESULT_TOOL = "final_result";

/** Tool name for the Nth schema in a union output array. */
export function unionToolName(index: number): string {
  return `final_result_${index}`;
}

/**
 * Returns `true` if the given tool name is any final_result variant
 * (either `final_result` or `final_result_N`).
 */
export function isFinalResultTool(name: string): boolean {
  return name === FINAL_RESULT_TOOL || /^final_result_\d+$/.test(name);
}

/**
 * Extracts the schema index from a union tool name (`final_result_N → N`).
 * Returns `undefined` if the name is not a union tool name.
 */
export function unionToolIndex(name: string): number | undefined {
  const m = name.match(/^final_result_(\d+)$/);
  return m ? parseInt(m[1], 10) : undefined;
}

// ---------------------------------------------------------------------------
// Schema normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise `outputSchema` to an array. A single schema becomes `[schema]`;
 * an array is returned as-is.
 */
export function normaliseSchemas(
  outputSchema: ZodTypeAny | ZodTypeAny[] | undefined,
): ZodTypeAny[] {
  if (!outputSchema) return [];
  return Array.isArray(outputSchema) ? outputSchema : [outputSchema];
}

/**
 * Returns `true` when `outputSchema` is an array (union mode).
 */
export function isUnionSchema(
  outputSchema: ZodTypeAny | ZodTypeAny[] | undefined,
): boolean {
  return Array.isArray(outputSchema) && outputSchema.length > 1;
}

// ---------------------------------------------------------------------------
// Tool map registration
// ---------------------------------------------------------------------------

/**
 * Register one or more `final_result` tools into an existing `ToolSet`.
 *
 * - Single schema: registers `"final_result"`.
 * - Array of schemas: registers `"final_result_0"`, `"final_result_1"`, etc.
 *
 * Mutates `toolMap` in place (the caller owns the object — this is an
 * intentional write to a freshly constructed map).
 */
export function registerOutputTools(
  toolMap: ToolSet,
  outputSchema: ZodTypeAny | ZodTypeAny[] | undefined,
): void {
  if (!outputSchema) return;

  const schemas = normaliseSchemas(outputSchema);

  if (schemas.length === 1) {
    toolMap[FINAL_RESULT_TOOL] = aiTool({
      description: "Return the final structured result.",
      inputSchema: schemas[0],
      execute: (input) => Promise.resolve(input),
    });
  } else {
    for (let i = 0; i < schemas.length; i++) {
      toolMap[unionToolName(i)] = aiTool({
        description: `Return the final structured result (variant ${i}).`,
        inputSchema: schemas[i],
        execute: (input) => Promise.resolve(input),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// JSON schema extraction (for prompted / native modes)
// ---------------------------------------------------------------------------

/**
 * Extract the JSON Schema representation from a Zod v4 schema.
 * Traverses the schema's internal `_def` structure to build a minimal
 * JSON Schema object suitable for system prompt injection.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return extractJsonSchema(schema);
}

/** Best-effort JSON Schema extraction from a Zod v4 schema object. */
function extractJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  // Access Zod's internal `_def` structure to extract type information.
  const schemaInternal = schema as unknown as {
    _def?: Record<string, unknown>;
  };
  const def = schemaInternal._def;
  if (!def) return { type: "object" };

  const typeName = def.typeName as string | undefined;
  return buildFromDef(typeName, def, schema);
}

function buildFromDef(
  typeName: string | undefined,
  def: Record<string, unknown>,
  schema: unknown,
): Record<string, unknown> {
  switch (typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodNull":
      return { type: "null" };
    case "ZodUndefined":
      return {};
    case "ZodArray":
      return {
        type: "array",
        items: extractJsonSchema(def.type as ZodTypeAny),
      };
    case "ZodEnum":
      return {
        type: "string",
        enum: (def.values as string[] | undefined) ?? [],
      };
    case "ZodOptional":
      return extractJsonSchema(def.innerType as ZodTypeAny);
    case "ZodNullable":
      return {
        oneOf: [extractJsonSchema(def.innerType as ZodTypeAny), {
          type: "null",
        }],
      };
    case "ZodObject": {
      const shape = (def.shape as Record<string, ZodTypeAny>) ?? {};
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        const vInternal = v as unknown as { _def?: { typeName?: string } };
        const vTypeName = vInternal._def?.typeName;
        const isOptional = vTypeName === "ZodOptional" ||
          vTypeName === "ZodNullable";
        properties[k] = extractJsonSchema(v);
        if (!isOptional) required.push(k);
      }
      const result: Record<string, unknown> = { type: "object", properties };
      if (required.length > 0) result.required = required;
      return result;
    }
    case "ZodUnion": {
      const options = (def.options as ZodTypeAny[] | undefined) ?? [];
      return { oneOf: options.map(extractJsonSchema) };
    }
    default: {
      // Last resort: check if schema has a toJSON or _toJsonSchema method
      const schemaObj = schema as Record<string, unknown>;
      if (typeof schemaObj?.["toJSON"] === "function") {
        return (schemaObj["toJSON"] as () => Record<string, unknown>)();
      }
      return { type: "object" };
    }
  }
}

// ---------------------------------------------------------------------------
// System prompt injection for 'prompted' mode
// ---------------------------------------------------------------------------

/**
 * Build the schema injection string to append to the system prompt when
 * `outputMode === 'prompted'`.
 */
export function buildSchemaPrompt(
  outputSchema: ZodTypeAny | ZodTypeAny[] | undefined,
): string {
  if (!outputSchema) return "";
  const schemas = normaliseSchemas(outputSchema);
  if (schemas.length === 1) {
    const jsonSchema = zodToJsonSchema(schemas[0]);
    return `Return a JSON object matching this schema:\n<schema>\n${
      JSON.stringify(jsonSchema, null, 2)
    }\n</schema>`;
  }
  // Union: list all variants
  const parts = schemas.map((s, i) => {
    const jsonSchema = zodToJsonSchema(s);
    return `Variant ${i}:\n${JSON.stringify(jsonSchema, null, 2)}`;
  });
  return `Return a JSON object matching one of the following schemas:\n<schema>\n${
    parts.join("\n\n")
  }\n</schema>`;
}

// ---------------------------------------------------------------------------
// Parse a text response against output schemas (prompted mode)
// ---------------------------------------------------------------------------

/** Result of attempting to parse text as structured output. */
export type ParseTextResult<TOutput> =
  | { success: true; data: TOutput }
  | { success: false; error: Error };

/**
 * Attempt to parse a JSON text response against one or more Zod schemas.
 * For union schemas, tries each schema in order and returns the first success.
 */
export function parseTextOutput<TOutput>(
  text: string,
  outputSchema: ZodTypeAny | ZodTypeAny[] | undefined,
): ParseTextResult<TOutput> {
  if (!outputSchema) {
    return { success: false, error: new Error("No output schema") };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      success: false,
      error: new Error(`Invalid JSON in model response: ${String(e)}`),
    };
  }

  const schemas = normaliseSchemas(outputSchema);
  let lastError: Error | undefined;
  for (const schema of schemas) {
    const result = schema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data as TOutput };
    }
    lastError = result.error;
  }

  return {
    success: false,
    error: lastError ?? new Error("Parse failed"),
  };
}
