# Dependencies

Dependencies are runtime values you inject into an agent run — things like database connections, API clients, user sessions, or configuration. They flow through the entire run and are accessible in tools, dynamic system prompts, and result validators.

## Defining a Deps Type

Declare a type for your dependencies and pass it as the first type parameter to `Agent`:

```ts
type Deps = {
  db: Database;
  userId: string;
  featureFlags: Record<string, boolean>;
};

const agent = new Agent<Deps>({
  model: ...,
  systemPrompt: "You are a helpful assistant.",
});
```

## Injecting Dependencies at Run Time

Pass `deps` when calling `.run()` or `.stream()`:

```ts
const result = await agent.run("What are my recent orders?", {
  deps: {
    db: myDatabase,
    userId: "user_123",
    featureFlags: { newCheckout: true },
  },
});
```

A fresh `RunContext<Deps>` is created for each call — deps are never shared across runs.

## Accessing Deps in Tools

```ts
const getOrders = tool<Deps>({
  name: "get_orders",
  description: "Fetch recent orders for the current user",
  parameters: z.object({
    limit: z.number().default(10),
  }),
  execute: async (ctx, { limit }) => {
    const orders = await ctx.deps.db.orders.findByUser(ctx.deps.userId, limit);
    return orders;
  },
});
```

The `tool<Deps>()` call pins the tool's `TDeps` to `Deps`, so TypeScript knows the exact shape of `ctx.deps`.

## Accessing Deps in Dynamic System Prompts

```ts
const agent = new Agent<Deps>({
  model: ...,
  dynamicSystemPrompt: async (ctx) => {
    const user = await ctx.deps.db.users.findById(ctx.deps.userId);
    return `You are assisting ${user.name}. Their plan: ${user.plan}.`;
  },
});
```

Dynamic prompts are `async`-friendly and can make database or network calls.

## Accessing Deps in Result Validators

```ts
const agent = new Agent<Deps, Output>({
  model: ...,
  outputSchema: OutputSchema,
  resultValidators: [
    async (ctx, output) => {
      const allowed = await ctx.deps.db.permissions.check(ctx.deps.userId, output.action);
      if (!allowed) throw new Error(`User is not permitted to perform: ${output.action}`);
      return output;
    },
  ],
});
```

## Agents Without Dependencies

If you don't need deps, omit `TDeps` — it defaults to `undefined`:

```ts
const agent = new Agent({ model: ..., systemPrompt: "Be helpful." });

// No deps needed at run time
const result = await agent.run("Hello.");
```

Tools and prompts still receive a `RunContext<undefined>` — `ctx.deps` is `undefined`.

## Sharing Expensive Resources

Create deps once and reuse across runs. Connections and clients are safe to share:

```ts
const sharedDeps = {
  db: await Database.connect(process.env.DATABASE_URL),
  cache: new RedisClient(),
};

// Each run gets its own RunContext, but shares the same db and cache instances
const r1 = await agent.run("Query 1", {
  deps: { ...sharedDeps, userId: "u1" },
});
const r2 = await agent.run("Query 2", {
  deps: { ...sharedDeps, userId: "u2" },
});
```

## Type Safety

TypeScript enforces that the `deps` you pass at run time matches the agent's `TDeps`, and that all tools registered on the agent share the same `TDeps`:

```ts
type Deps = { apiKey: string };

const tool1 = tool<Deps>({ ... }); // ✓
const tool2 = tool<{ other: string }>({ ... }); // ✗ type error on agent.addTool(tool2)
```
