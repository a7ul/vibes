# Toolsets

A `Toolset` is a composable, context-aware group of tools that is resolved per
turn — letting you dynamically include or exclude tools based on the current run
context.

## What is a Toolset?

Individual tools registered on an agent are static. A toolset is different: its
`tools()` method receives the `RunContext` on every turn and returns the tools
to expose at that moment. This enables permission-based visibility,
context-driven loading, and tool composition patterns.

Use toolsets when you need:

- Tools that appear or disappear based on runtime state (e.g. user role)
- Reusable groups of tools shared across many agents
- Namespace isolation when combining tool libraries

## The `Toolset` Interface

```ts
interface Toolset<TDeps = undefined> {
  tools(
    ctx: RunContext<TDeps>,
  ): ToolDefinition<TDeps>[] | Promise<ToolDefinition<TDeps>[]>;
}
```

Register toolsets on an agent via the `toolsets` option:

```ts
import { Agent, FunctionToolset } from "./mod.ts";

const agent = new Agent({
  model,
  toolsets: [myToolset],
});
```

## `FunctionToolset`

The simplest toolset: a mutable list of tool definitions.

```ts
import { FunctionToolset, tool } from "./mod.ts";
import { z } from "zod";

const search = tool({
  name: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: async (_ctx, { query }) => fetchResults(query),
});

const toolset = new FunctionToolset([search]);
toolset.addTool(anotherTool); // add more later

const agent = new Agent({ model, toolsets: [toolset] });
```

| Method                        | Description                           |
| ----------------------------- | ------------------------------------- |
| `new FunctionToolset(tools?)` | Construct with optional initial tools |
| `addTool(tool)`               | Append a tool definition              |
| `tools()`                     | Returns current tool list (copy)      |

## `CombinedToolset`

Merges two or more toolsets into one. If two tools share the same name, the last
toolset wins.

```ts
import { CombinedToolset } from "./mod.ts";

const combined = new CombinedToolset(searchToolset, fetchToolset, dbToolset);
const agent = new Agent({ model, toolsets: [combined] });
```

## `FilteredToolset`

Wraps a toolset with a per-turn predicate. Returns an empty tool list when the
predicate returns `false`.

```ts
import { FilteredToolset } from "./mod.ts";

// Only expose admin tools when the user has the admin role
const adminOnly = new FilteredToolset(
  adminToolset,
  (ctx) => ctx.deps.user.role === "admin",
);

const agent = new Agent<MyDeps>({ model, toolsets: [adminOnly] });
```

The predicate can be async:

```ts
const filtered = new FilteredToolset(
  sensitiveToolset,
  async (ctx) => {
    const perms = await ctx.deps.db.permissions.get(ctx.deps.userId);
    return perms.canAccessSensitive;
  },
);
```

## `PrefixedToolset` and `RenamedToolset`

Avoid name collisions when combining tool libraries.

```ts
import { PrefixedToolset, RenamedToolset } from "./mod.ts";

// All tool names get a prefix: "search" → "web_search"
const webTools = new PrefixedToolset(searchToolset, "web_");

// Rename specific tools: { oldName: newName }
const renamed = new RenamedToolset(myToolset, { search: "find_docs" });
```

## Recipes

### Role-Based Tool Visibility

Show different tool groups to different users:

```ts
type Deps = { user: { role: "admin" | "viewer" } };

const viewerTools = new FunctionToolset([readTool, searchTool]);
const adminTools = new FilteredToolset(
  new FunctionToolset([writeTool, deleteTool]),
  (ctx) => ctx.deps.user.role === "admin",
);

const agent = new Agent<Deps>({
  model,
  toolsets: [new CombinedToolset(viewerTools, adminTools)],
});
```

### Namespaced Tool Libraries

Compose multiple tool packages without name conflicts:

```ts
const agent = new Agent({
  model,
  toolsets: [
    new PrefixedToolset(searchToolset, "search_"),
    new PrefixedToolset(storageToolset, "storage_"),
    new PrefixedToolset(emailToolset, "email_"),
  ],
});
```

### Dynamic Tool Loading

Load tools from a database or config at runtime:

```ts
class DynamicToolset implements Toolset<MyDeps> {
  async tools(ctx: RunContext<MyDeps>) {
    const configs = await ctx.deps.db.tools.findByUser(ctx.deps.userId);
    return configs.map((cfg) =>
      tool({
        name: cfg.name,
        description: cfg.description,
        parameters: z.object({ input: z.string() }),
        execute: async (_ctx, { input }) => callWebhook(cfg.webhookUrl, input),
      })
    );
  }
}

const agent = new Agent<MyDeps>({ model, toolsets: [new DynamicToolset()] });
```

## API Reference

### `Toolset<TDeps>` interface

| Method  | Signature                                                             | Description                                   |
| ------- | --------------------------------------------------------------------- | --------------------------------------------- |
| `tools` | `(ctx: RunContext<TDeps>) => ToolDefinition<TDeps>[] \| Promise<...>` | Called each turn to get the current tool list |

### `FunctionToolset<TDeps>`

| Method      | Signature                               | Description                        |
| ----------- | --------------------------------------- | ---------------------------------- |
| constructor | `(tools?: ToolDefinition<TDeps>[])`     | Initial tool list (optional)       |
| `addTool`   | `(tool: ToolDefinition<TDeps>) => void` | Append a tool                      |
| `tools`     | `() => ToolDefinition<TDeps>[]`         | Returns a copy of the current list |

### `CombinedToolset<TDeps>`

| Constructor arg | Type               | Description                   |
| --------------- | ------------------ | ----------------------------- |
| `...toolsets`   | `Toolset<TDeps>[]` | Two or more toolsets to merge |

### `FilteredToolset<TDeps>`

| Constructor arg | Type                                   | Description                         |
| --------------- | -------------------------------------- | ----------------------------------- |
| `inner`         | `Toolset<TDeps>`                       | Toolset to wrap                     |
| `predicate`     | `(ctx) => boolean \| Promise<boolean>` | Return `true` to expose the toolset |

### `PrefixedToolset<TDeps>`

| Constructor arg | Type             | Description                         |
| --------------- | ---------------- | ----------------------------------- |
| `inner`         | `Toolset<TDeps>` | Toolset to wrap                     |
| `prefix`        | `string`         | String prepended to every tool name |

### `RenamedToolset<TDeps>`

| Constructor arg | Type                     | Description                    |
| --------------- | ------------------------ | ------------------------------ |
| `inner`         | `Toolset<TDeps>`         | Toolset to wrap                |
| `nameMap`       | `Record<string, string>` | `{ oldName: newName }` mapping |

## Error Behavior

- `FilteredToolset`: predicate errors propagate as unhandled rejections — guard
  your predicate.
- `CombinedToolset`: if any member toolset's `tools()` throws, the entire
  combined call fails.
- `PrefixedToolset`/`RenamedToolset`: purely synchronous transforms — no error
  surface beyond the inner toolset.
