# OpenTelemetry

Instrument agents with OpenTelemetry tracing via the Vercel AI SDK's built-in
telemetry support, without manual span management.

## How It Works

`instrumentAgent()` returns a thin proxy around an agent that injects
`TelemetrySettings` (`experimental_telemetry`) into every `.run()`, `.stream()`,
and `runStreamEvents()` call. The Vercel AI SDK then creates spans for every
model call and tool invocation automatically.

## Basic Usage

```ts
import { instrumentAgent } from "./mod.ts";
import { Agent } from "./mod.ts";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new Agent({
  name: "my-agent",
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "You are a helpful assistant.",
});

// Wrap with instrumentation
const instrumented = instrumentAgent(agent, {
  isEnabled: true,
  metadata: { environment: "production", version: "1.2.0" },
});

// Use exactly like the original agent
const result = await instrumented.run("Hello!");
```

Spans appear in whatever OpenTelemetry-compatible backend you have configured
(e.g. Jaeger, Honeycomb, Datadog, OTLP collector).

## `InstrumentationOptions`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `isEnabled` | `boolean` | `true` | Enable or disable telemetry |
| `functionId` | `string` | agent name | Span function identifier |
| `metadata` | `Record<string, string \| number \| boolean>` | — | Extra attributes added to every span |
| `excludeContent` | `boolean` | `false` | Omit prompt/completion content from spans (for privacy) |

## `TelemetrySettings`

The underlying `TelemetrySettings` type from `ai` is passed directly to Vercel
AI SDK's `generateText`/`streamText`. `instrumentAgent()` builds this for you,
but you can construct it manually for lower-level use:

```ts
import { createTelemetrySettings } from "./mod.ts";

const settings = createTelemetrySettings("my-agent", {
  isEnabled: true,
  functionId: "classify-intent",
  metadata: { userId: "u_123" },
});
```

## Privacy: `excludeContent`

Set `excludeContent: true` to omit prompt text and completion text from spans.
Span metadata (model name, token counts, finish reason) is still recorded:

```ts
const instrumented = instrumentAgent(agent, {
  isEnabled: true,
  excludeContent: true, // no PII in traces
});
```

## Per-Run Override

Override telemetry settings for a single run:

```ts
const result = await instrumented.run("Sensitive request.", {
  telemetry: {
    isEnabled: false, // disable tracing for this run
  },
});
```

## OTel Setup (Deno)

Configure an OTLP exporter before using `instrumentAgent()`:

```ts
import { NodeSDK } from "npm:@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "npm:@opentelemetry/exporter-trace-otlp-http";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: "https://otel-collector.example.com/v1/traces",
    headers: { "x-api-key": Deno.env.get("OTEL_API_KEY")! },
  }),
});

sdk.start();

// Now create and instrument your agents
const instrumented = instrumentAgent(agent, { isEnabled: true });
```

## Recipes

### Per-Request Metadata

Attach request-specific metadata for trace filtering:

```ts
async function handleRequest(userId: string, prompt: string) {
  const instrumented = instrumentAgent(agent, {
    isEnabled: true,
    metadata: { userId, requestId: crypto.randomUUID() },
  });
  return instrumented.run(prompt, { deps: { userId } });
}
```

### Disable in Tests

```ts
import { instrumentAgent, setAllowModelRequests } from "./mod.ts";

setAllowModelRequests(false);

const instrumented = instrumentAgent(agent, { isEnabled: false });
// Use with a mock model — no spans created
```

## Error Behavior

- `instrumentAgent()` does not throw if OTel is not configured — it falls back
  to a no-op tracer silently.
- Errors in the wrapped agent propagate unchanged through the instrumented proxy.
- If `isEnabled: false`, no spans are created and performance overhead is zero.
