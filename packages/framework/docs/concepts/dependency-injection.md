---
title: "Dependency Injection"
description: "Type-safe deps pattern for tools, prompts, and validators"
---

# Dependency Injection

Vibes uses a type-safe dependency injection pattern — the same one pydantic-ai uses. Your tools, system prompts, and validators can access databases, APIs, config, and any other runtime state without globals or singletons.

> **Coming from pydantic-ai?** This is pydantic-ai's `deps` pattern, almost identical. `RunContext<TDeps>` maps to `RunContext[TDeps]`.

## The Problem

Without DI, tools reach for globals:

```ts
// Bad — globals, untestable, hard to swap
const db = new Database(process.env.DATABASE_URL!);

const lookupUser = tool({
  execute: async (_ctx, { email }) => {
    return await db.users.findByEmail(email);  // relies on global
  },
});
```

## The Solution

Declare what your agent needs as a type, pass it at run time:

```ts
// 1. Define what your agent needs
type Deps = {
  db: Database;
  emailService: EmailService;
};

// 2. Use deps in tools — type-safe
const lookupUser = tool({
  name: "lookup_user",
  description: "Find a user by email",
  parameters: z.object({ email: z.string().email() }),
  execute: async (ctx, { email }) => {
    // ctx.deps is typed as Deps ✓
    return await ctx.deps.db.users.findByEmail(email);
  },
});

// 3. Create agent with TDeps type parameter
const agent = new Agent<Deps>({
  model: anthropic("claude-haiku-4-5-20251001"),
  tools: [lookupUser],
});

// 4. Inject at run time
const result = await agent.run("Find alice@example.com", {
  deps: {
    db: new Database(process.env.DATABASE_URL!),
    emailService: new EmailService(),
  },
});
```

The `deps` object is available everywhere a `RunContext` is passed.

## Dynamic System Prompts

```ts
type Deps = { user: User; locale: string };

const agent = new Agent<Deps>({
  model,
  systemPrompt: (ctx) =>
    `You are helping ${ctx.deps.user.name}. Respond in ${ctx.deps.locale}.`,
});
```

## Result Validators

```ts
type Deps = { db: Database };

const agent = new Agent<Deps, OutputType>({
  model,
  outputSchema: OutputSchema,
  resultValidators: [
    async (ctx, output) => {
      // Validate output against the database
      const exists = await ctx.deps.db.items.exists(output.itemId);
      if (!exists) throw new Error(`Item ${output.itemId} does not exist`);
      return output;
    },
  ],
});
```

## Multiple Levels of Nesting

In multi-agent systems, deps flow down to sub-agents too:

```ts
type AppDeps = { db: Database; cache: Cache };

const subAgent = new Agent<AppDeps>({
  model,
  tools: [cacheLookup, dbQuery],
});

const orchestrator = new Agent<AppDeps>({
  model,
  tools: [
    tool({
      name: "delegate_to_sub_agent",
      execute: async (ctx, args) => {
        // Pass deps down to sub-agent
        return await subAgent.run(args.prompt, { deps: ctx.deps });
      },
    }),
  ],
});
```

## Testing with Fakes

The real power of DI shows in tests. Swap real dependencies with fakes:

```ts
Deno.test("lookup_user tool works correctly", async () => {
  const fakeDeps: Deps = {
    db: {
      users: {
        findByEmail: async (email) =>
          email === "alice@example.com"
            ? { id: "u1", name: "Alice", email }
            : null,
      },
    },
    emailService: { send: async () => {} },
  };

  const result = await agent
    .override({ model: mockModel })
    .run("Find alice@example.com", { deps: fakeDeps });

  assertEquals(result.output.includes("Alice"), true);
});
```

No database setup, no network calls, instant tests.

## Pattern: Deps Interface

For larger projects, define deps as an interface in its own file:

```ts
// deps.ts
export interface AppDeps {
  db: Database;
  cache: RedisCache;
  config: AppConfig;
  logger: Logger;
}

// For tests
export const testDeps: AppDeps = {
  db: new InMemoryDatabase(),
  cache: new FakeCache(),
  config: testConfig,
  logger: new NoopLogger(),
};
```

## Pattern: Factory Function

Create agents via a factory that receives deps:

```ts
function createSupportAgent(deps: AppDeps) {
  return new Agent<AppDeps>({
    model: anthropic("claude-sonnet-4-6"),
    systemPrompt: (ctx) => `Helping user: ${ctx.deps.config.supportEmail}`,
    tools: [lookupTicket, createTicket, escalate],
  });
}

// Production
const agent = createSupportAgent(productionDeps);

// Test
const agent = createSupportAgent(testDeps);
```

## No Deps

If your agent doesn't need dependencies, omit `TDeps` (defaults to `undefined`):

```ts
// No deps needed
const agent = new Agent({
  model,
  systemPrompt: "You are a helpful assistant.",
  tools: [
    tool({
      execute: async (_ctx, args) => {
        // ctx.deps is undefined — that's fine
        return "result";
      },
    }),
  ],
});
```

## Next Steps

- [Run Context](../reference/core/run-context) — full `RunContext` API reference
- [Testing](./testing.md) — how DI makes testing easy
- [Multi-Agent Systems](../guides/multi-agent-systems.md) — passing deps across agents
