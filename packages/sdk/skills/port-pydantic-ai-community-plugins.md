---
name: port-pydantic-ai-community-plugins
description: Step-by-step guide for porting a pydantic-ai community plugin (toolset, skill) to @vibesjs/sdk community/. Includes conceptual mapping, worked example, and contribution instructions.
---

You are porting a Python pydantic-ai community plugin to TypeScript `@vibesjs/sdk`. Follow the steps below. Always fetch the latest SDK docs before writing code.

## Step 1: Fetch live docs

Fetch `https://raw.githubusercontent.com/a7ul/vibes/main/packages/sdk/docs/index.md` to get the full doc index, then fetch the relevant sections (toolsets, tools, dependencies).

---

## Conceptual mapping

| Python (pydantic-ai) | TypeScript (@vibesjs/sdk) |
|----------------------|--------------------------|
| `FunctionToolset` | `FunctionToolset` |
| Custom class inheriting `Toolset` | Class implementing `Toolset<TDeps>` interface |
| `@agent.tool` decorator | `tool<TDeps, TParams>({ name, description, parameters, execute })` |
| `@agent.tool_plain` decorator | `plainTool<TParams>({ ... })` |
| `RunContext[TDeps]` | `RunContext<TDeps>` |
| `ctx.deps` | `ctx.deps` |
| Pydantic `BaseModel` for params | Zod `z.object({})` for params |
| `async def execute(ctx, **kwargs)` | `execute: async (ctx, args) => ...` |
| `str` / `dict` return | `string` / `object` return (JSON.stringify for objects) |
| In-memory state (Python dict/list) | Class field (`Map`, `Array`) — never mutate in place, return new copies |

---

## Step-by-step conversion

1. **Read the Python source** — identify the class, its constructor arguments, internal state, and each `@tool`-decorated method.

2. **Map constructor args** — if the Python class accepts a storage object, create a TypeScript interface for it (e.g., `TodoStore`). Provide a default in-memory implementation.

3. **Create the directory** — `packages/sdk/community/<name>/`

4. **Write `types.ts`** — interfaces for data models and the storage interface (if any).

5. **Write the store implementation** — `memory_<name>_store.ts`. Keep state in a `Map`; never mutate in place.

6. **Write the toolset** — `<name>_toolset.ts`:
   - `export class MyToolset<TDeps = undefined> implements Toolset<TDeps>`
   - Constructor: `constructor(storeOrOptions?: MyStore)`
   - `tools(_ctx: RunContext<TDeps>): ToolDefinition<TDeps>[]`
   - Capture store/state in closure inside `tools()` so each tool references the instance's store.

7. **Write `mod.ts`** — re-export everything from the sub-files.

8. **Update `community/mod.ts`** — add re-exports.

9. **Update `packages/sdk/mod.ts`** — add named exports under `// Community toolsets`.

10. **Write tests** — `packages/sdk/tests/community_<name>_toolset_test.ts`. Test the store in isolation first, then test tool execution directly via `tool.execute(null as never, args)`, then test integration with `MockLanguageModelV3`.

11. **Type-check** — run `deno check packages/sdk/community/mod.ts`.

---

## Worked example: pydantic-ai-todo → TodoToolset

### Python (before)

```python
class TodoToolset(FunctionToolset):
    def __init__(self, store: TodoStore = None):
        self.store = store or MemoryTodoStore()

    @agent.tool
    async def todo_add(self, ctx: RunContext, title: str, parent_id: str | None = None) -> str:
        todo = await self.store.add(title=title, parent_id=parent_id)
        return json.dumps(todo)
```

### TypeScript (after)

```typescript
// types.ts
export type TodoStatus = "pending" | "in_progress" | "done" | "cancelled";
export interface Todo { id: string; title: string; status: TodoStatus; ... }
export interface TodoStore {
  add(todo: Omit<Todo, "id" | "createdAt" | "updatedAt">): Promise<Todo>;
  list(filter?: { status?: TodoStatus }): Promise<Todo[]>;
  update(id: string, status: TodoStatus): Promise<Todo>;
  clear(): Promise<void>;
}

// todo_toolset.ts
export class TodoToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly store: TodoStore;
  constructor(store?: TodoStore) {
    this.store = store ?? new MemoryTodoStore();
  }
  tools(_ctx: RunContext<TDeps>): ToolDefinition<TDeps>[] {
    const store = this.store;
    return [
      tool<TDeps, typeof AddParams>({
        name: "todo_add",
        description: "Create a new todo item.",
        parameters: AddParams,
        execute: async (_ctx, args) => {
          const todo = await store.add({ title: args.title, status: "pending", dependsOn: [] });
          return JSON.stringify(todo);
        },
      }),
      // ... more tools
    ];
  }
}
```

---

## Quick reference

### `Toolset<TDeps>` interface

```typescript
interface Toolset<TDeps = undefined> {
  tools(ctx: RunContext<TDeps>): ToolDefinition<TDeps>[] | Promise<ToolDefinition<TDeps>[]>;
}
```

### `tool()` factory

```typescript
tool<TDeps, TParams extends ZodType>({
  name: string,
  description: string,
  parameters: TParams,              // Zod schema
  execute: async (ctx: RunContext<TDeps>, args: z.infer<TParams>) => string | object,
  maxRetries?: number,
  sequential?: boolean,
})
```

### `plainTool()` factory (no context needed)

```typescript
plainTool<TParams extends ZodType>({
  name, description, parameters,
  execute: async (args: z.infer<TParams>) => string | object,
})
```

---

## Critical gotchas

- **Return strings or JSON-stringified objects** — tool `execute` must return `string | object`. For structured data, `return JSON.stringify(result)`.
- **Capture store in closure** — inside `tools()`, assign `const store = this.store` before the array literal. Arrow functions in the array capture `store`, not `this`.
- **Never mutate** — always return new objects from store methods. Use spread: `{ ...existing, status: newStatus }`.
- **`TDeps` flows through** — the toolset generic `<TDeps>` must match the agent's `Deps` type. If the tools don't use deps, `TDeps = undefined` is the default and is compatible with any agent via type widening.
- **Test without API** — call `tool.execute(null as never, args)` directly in unit tests; the context is `null` since community tools typically don't use it.

---

## Contributing

1. Create `packages/sdk/community/<your-toolset>/` with the files above.
2. Export from `packages/sdk/community/mod.ts`.
3. Export from `packages/sdk/mod.ts` under `// Community toolsets`.
4. Add tests in `packages/sdk/tests/community_<your-toolset>_test.ts`.
5. Run `deno check packages/sdk/community/mod.ts` — must have no errors.
6. Run `deno task test` from the repo root — all existing tests must pass.
7. Add a doc page at `packages/sdk/docs/community/<your-toolset>.mdx`.
8. Open a PR — title format: `feat(community): add <YourToolset>`.
