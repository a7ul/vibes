# Structured Output

By default, agents return a plain string. Providing an `outputSchema` tells the agent to return validated, typed JSON instead.

> **Coming from pydantic-ai?** This is equivalent to pydantic-ai's `result_type`. Vibes uses Zod instead of Pydantic models.

## Basic Example

```ts
import { Agent } from "@vibes/framework";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const CountryInfo = z.object({
  name: z.string(),
  capital: z.string(),
  population: z.number().describe("Population in millions"),
  languages: z.array(z.string()),
});

const agent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "You are a geography expert. Always respond with structured data.",
  outputSchema: CountryInfo,
});

const result = await agent.run("Tell me about Japan.");

// result.output is typed as z.infer<typeof CountryInfo>
console.log(result.output.capital);     // "Tokyo"
console.log(result.output.population);  // 125.7
console.log(result.output.languages);   // ["Japanese"]
```

## How It Works

When you provide `outputSchema`, Vibes automatically injects a `final_result` tool. The model must call this tool to end the run — it cannot return a plain text answer.

The `final_result` tool's parameters are derived from your Zod schema. The model fills in the fields, Zod validates the result, and you get a fully typed `result.output`.

## Zod Schema Tips

Use `.describe()` on fields to give the model context:

```ts
const SearchResult = z.object({
  title: z.string().describe("The page title"),
  url: z.string().url().describe("The full URL including https://"),
  summary: z.string().describe("A 1-2 sentence summary of the page content"),
  relevanceScore: z.number().min(0).max(1).describe("How relevant this result is, 0-1"),
});
```

The better your descriptions, the more accurately the model fills in the fields.

## Type Safety

The output type flows through generics automatically:

```ts
const agent = new Agent({
  model,
  outputSchema: CountryInfo,
});

const result = await agent.run("Tell me about Brazil.");
//    ^^^^^^ RunResult<z.infer<typeof CountryInfo>>

result.output.capital;     // TypeScript knows this is string ✓
result.output.population;  // TypeScript knows this is number ✓
result.output.xyz;         // TypeScript error — field doesn't exist ✓
```

## Validation and Retries

If the model produces output that fails Zod validation, Vibes automatically sends the validation error back to the model and asks it to try again. This happens up to `maxRetries` times (default: 3).

```ts
const agent = new Agent({
  model,
  outputSchema: z.object({
    score: z.number().min(1).max(10),
  }),
  maxRetries: 5,  // up to 5 attempts to get a valid score
});
```

## Combining with Tools

Structured output and tools work together. The agent can call tools to gather information, then return structured output:

```ts
const ProductInfo = z.object({
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
  description: z.string(),
});

const agent = new Agent({
  model,
  outputSchema: ProductInfo,
  tools: [fetchProductDetails, checkInventory],
});

const result = await agent.run("Get info about product SKU-12345");
// The agent called tools, then returned structured ProductInfo
console.log(result.output.inStock);  // true
```

## Union Types

For agents that can return different shapes depending on the query, use Zod union:

```ts
const SearchResponse = z.discriminatedUnion("type", [
  z.object({ type: z.literal("found"), data: ProductInfo }),
  z.object({ type: z.literal("not_found"), reason: z.string() }),
]);

const agent = new Agent({ model, outputSchema: SearchResponse });

const result = await agent.run("Find product XYZ-999");

if (result.output.type === "found") {
  console.log(result.output.data.name);
} else {
  console.log(result.output.reason);
}
```

## Result Validators

For validation beyond what Zod can express, add result validators:

```ts
const agent = new Agent({
  model,
  outputSchema: z.object({ recommendation: z.string(), confidence: z.number() }),
  resultValidators: [
    (_ctx, output) => {
      if (output.confidence < 0.5) {
        throw new Error("Confidence too low — try a different approach");
      }
      return output;
    },
  ],
});
```

See [Result Validators](../result-validators.md) for details.

## Next Steps

- [Testing Your Agent](./testing.md) — test structured output without API calls
- [Result Validators](../result-validators.md) — post-process and validate output
- [Streaming](../streaming.md) — stream partial output as it arrives
