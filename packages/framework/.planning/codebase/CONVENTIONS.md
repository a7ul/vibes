# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- `snake_case` for all source files: `test_model.ts`, `function_model.ts`, `_run_utils.ts`
- Underscore prefix for internal-only files: `_run_utils.ts`, `_helpers.ts`
- Test files use `_test.ts` suffix: `agent_test.ts`, `toolsets_test.ts`
- Module barrel files named `mod.ts`

**Classes:**
- `PascalCase`: `Agent`, `TestModel`, `FunctionModel`, `BaseNode`, `Graph`, `MCPToolset`
- Error classes suffixed with `Error`: `MaxTurnsError`, `MaxRetriesError`, `ApprovalRequiredError`

**Functions and variables:**
- `camelCase` for functions: `executeRun`, `executeStream`, `toolCallResponse`, `textResponse`
- `camelCase` for variables: `runId`, `toolCallId`, `maxRetries`
- `UPPER_SNAKE_CASE` for module-level constants and sentinels: `BINARY_IMAGE_OUTPUT`, `FINAL_RESULT_TOOL`

**Types and Interfaces:**
- `PascalCase` for types and interfaces: `ToolDefinition`, `RunContext`, `AgentOptions`, `NodeResult`
- Generic type parameters use single uppercase with prefix: `TDeps`, `TOutput`, `TState`, `TParams`
- Discriminated unions use `readonly kind: "..."` literal fields

**Zod schemas:**
- `PascalCase` matching the output type: `OutputSchema`, `CountryInfo`

## TypeScript Patterns

**Generics:**
- Two-parameter pattern on `Agent<TDeps, TOutput>` and tools `tool<TDeps, TParams>`
- `TDeps = undefined` as default when no dependency injection needed
- Inferred from Zod: `z.infer<typeof OutputSchema>`, `z.infer<TParams>`

**Discriminated unions (graph types):**
```typescript
// lib/graph/types.ts
export type NodeResult<TState, TOutput> =
  | { readonly kind: "next"; readonly nodeId: NodeId; readonly state: TState }
  | { readonly kind: "output"; readonly output: TOutput };
```
All union variants use `readonly` fields and a `kind` discriminant.

**Interface vs type:**
- `interface` for public data shapes with optional fields: `AgentOptions`, `RunOptions`, `ToolDefinition`
- `type` for union types, aliases, and callback signatures: `EndStrategy`, `SystemPromptFn`, `OutputMode`

**Import style:**
- Type-only imports use `import type { ... }`: `import type { ZodType } from "zod"`
- Value imports are separate: `import { z } from "zod"`
- Internal imports use `.ts` extension explicitly: `import { executeRun } from "./execution/run.ts"`

**Readonly arrays:**
- Public getters on `Agent` return `ReadonlyArray<T>`: `get tools(): ReadonlyArray<ToolDefinition<TDeps>>`
- Internal mutable arrays use `private _fieldName: T[]` pattern

## Code Style

**Formatting:**
- No dedicated formatter config detected (no `.prettierrc`, no `biome.json`)
- 2-space indentation
- Trailing commas in multi-line objects and arrays
- Single quotes for strings in imports, double quotes elsewhere

**Linting:**
- No `.eslintrc` or linting config detected
- Code relies on TypeScript's own strict typing

**Immutability:**
- `agent.override()` creates a new scoped runner without mutating the original agent
- Arrays from constructor options are copied: `this._tools = opts.tools ? [...opts.tools] : []`
- Results are returned as new objects, never modified in-place
- Public `readonly` modifiers on all class fields that must not change after construction

## Import Organization

**Order (observed pattern):**
1. External packages: `import { generateText } from "ai"`, `import { z } from "zod"`
2. Internal type imports: `import type { Agent } from "../agent.ts"`
3. Internal value imports: `import { executeRun } from "./execution/run.ts"`

**No path aliases** - all imports use relative paths with `.ts` extensions.

**Barrel re-exports:**
- `mod.ts` at the root re-exports the full public API
- Feature-level `mod.ts` files (e.g., `lib/graph/mod.ts`, `lib/mcp/mod.ts`) re-export their submodule

## Error Handling

**Error class pattern:**
```typescript
// lib/types/errors.ts
export class MaxTurnsError extends Error {
  constructor(turns: number) {
    super(`Agent exceeded maxTurns (${turns})`);
    this.name = "MaxTurnsError";
  }
}
```
- All custom errors extend `Error`
- `this.name` always set to the class name (enables `instanceof` and stack trace clarity)
- Structured data attached as `readonly` fields on the error class (e.g., `deferred`, `limitKind`, `current`, `limit`)
- Error messages are human-readable and include the relevant numbers

**Error propagation:**
- Framework errors (`MaxTurnsError`, `MaxRetriesError`, `ApprovalRequiredError`) are thrown, not returned
- Tool errors from `execute()` are caught internally and sent to the model as tool result messages
- Provider/network errors from the AI SDK propagate as-is to the caller
- Unknown errors are always re-thrown

**Validation errors:**
- Zod's `schema.safeParse()` is used to avoid throwing during parsing - failure leads to a retry nudge
- `argsValidator` throws to reject args without consuming a retry slot

## Zod Patterns

**Schema definition:**
- Schemas defined at module level with `PascalCase` names: `const OutputSchema = z.object({ ... })`
- `.describe()` added to fields that benefit from model-readable context
- `z.infer<typeof Schema>` used for TypeScript types derived from schemas
- Union of schemas supported: `outputSchema?: ZodType<TOutput> | ZodType[]`

**Runtime use:**
- `schema.safeParse(data)` for all parse operations (never throws)
- `schema.parse(data)` not used in framework internals

## Function Design

**Factory functions over constructors for tools:**
```typescript
// tool(), plainTool(), outputTool(), fromSchema() are factory functions
// that return ToolDefinition<TDeps> without using `new`
export function tool<TDeps, TParams extends ZodType>(...): ToolDefinition<TDeps>
```

**Optional parameters:**
- All optional fields follow the `field?: Type` pattern
- Defaults are applied with `??` inside constructors: `this.maxTurns = opts.maxTurns ?? 10`

**Async:**
- All execute functions return `Promise<T>`, never synchronously
- `async/await` used throughout; no `.then().catch()` chains in production code

## Comments

**When to comment:**
- File-level JSDoc on complex modules: `lib/testing/test_model.ts`, `lib/testing/function_model.ts`
- Method-level JSDoc on public API methods: `Agent.resume()`, `Agent.override()`
- Section dividers used in large files: `// ---------------------------------------------------------------------------`
- Inline comments only for non-obvious logic

**JSDoc style:**
```typescript
/**
 * Define a typed tool with Zod parameter validation.
 *
 * @example
 * ```ts
 * const search = tool<MyDeps, typeof SearchParams>({ ... });
 * ```
 */
```
- `@example` with fenced TypeScript code blocks in JSDoc
- `@param` and `@returns` used sparingly; prefer descriptive parameter names instead

## Module Design

**Exports:**
- `lib/` files use named exports only - no default exports
- `mod.ts` re-exports from `lib/` files explicitly (no `export *` wildcard)
- Types and values exported separately: `export type { Foo }` and `export { Bar }`

**Internal helpers:**
- Files prefixed with `_` are internal: `_run_utils.ts`, `_helpers.ts`
- Marked with `Not part of the public API` in file-level comment

## Documentation Conventions (MDX)

**Frontmatter:**
```mdx
---
title: "Your First Agent"
description: "Create and run your first agent in minutes"
---
```
Every page requires `title` and `description` in YAML frontmatter.

**Code blocks:**
- Always specify language: ` ```ts ` for TypeScript examples
- Import paths use `@vibes/framework` (the published package name), never relative paths
- Examples are self-contained and runnable

**Callouts:**
- Blockquote `>` used for Pydantic AI migration notes and important tips
- Format: `> **Coming from Pydantic AI?** ...`

**Doc structure pattern:**
1. Short intro paragraph (1-2 sentences)
2. Quick example code block
3. API reference table (for complex APIs)
4. Feature subsections with example per feature
5. "## Next Steps" section with links at bottom

**Navigation:**
- Defined in `docs/docs.json` under `navigation.groups`
- Mintlify theme (`"theme": "mint"`)
- No Mintlify-specific components (Accordion, Tabs, etc.) detected in current pages - plain MDX only

---

*Convention analysis: 2026-03-14*
