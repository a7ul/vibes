/**
 * Tests for output tool events in runStreamEvents() (ported from pydantic-ai v1.93.0).
 *
 * pydantic-ai v1.93.0 added OutputToolCallEvent / OutputToolResultEvent as separate
 * event types for calls to output tools (final_result and isOutput tools).
 *
 * In vibes TypeScript, this maps to:
 * - 'output-tool-call-start' - emitted when final_result or outputTool() is called
 * - 'output-tool-call-result' - emitted when final_result or outputTool() returns
 *
 * Function tools still emit 'tool-call-start' / 'tool-call-result'.
 */
import { assertEquals, assertExists } from "@std/assert";
import { z } from "zod";
import { Agent, outputTool, tool } from "../mod.ts";
import type { AgentStreamEvent } from "../mod.ts";
import {
  MockLanguageModelV3,
  textStream,
  toolCallStream,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Helper: drain all events into an array
// ---------------------------------------------------------------------------
async function collectEvents<T>(
  iterable: AsyncIterable<AgentStreamEvent<T>>,
): Promise<AgentStreamEvent<T>[]> {
  const events: AgentStreamEvent<T>[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests: final_result tool emits output-tool-call-start / output-tool-call-result
// ---------------------------------------------------------------------------

Deno.test(
  "output tool events - final_result emits output-tool-call-start not tool-call-start",
  async () => {
    const OutputSchema = z.object({ value: z.number() });

    const model = new MockLanguageModelV3({
      doStream: () =>
        Promise.resolve(toolCallStream("final_result", { value: 42 })),
    });

    type Output = z.infer<typeof OutputSchema>;

    const agent = new Agent<undefined, Output>({
      model,
      outputSchema: OutputSchema,
    });

    const events = await collectEvents(agent.runStreamEvents("get value"));

    // Should NOT emit tool-call-start for final_result
    const toolCallStarts = events.filter((e) => e.kind === "tool-call-start");
    assertEquals(toolCallStarts.length, 0);

    // Should emit output-tool-call-start for final_result
    const outputCallStarts = events.filter(
      (e) => e.kind === "output-tool-call-start",
    );
    assertEquals(outputCallStarts.length, 1);

    const evt = outputCallStarts[0] as {
      kind: "output-tool-call-start";
      toolName: string;
      toolCallId: string;
      args: Record<string, unknown>;
    };
    assertEquals(evt.toolName, "final_result");
    assertExists(evt.toolCallId);
    assertEquals(evt.args.value, 42);
  },
);

Deno.test(
  "output tool events - final_result emits output-tool-call-result not tool-call-result",
  async () => {
    const OutputSchema = z.object({ value: z.number() });

    const model = new MockLanguageModelV3({
      doStream: () =>
        Promise.resolve(toolCallStream("final_result", { value: 42 })),
    });

    type Output = z.infer<typeof OutputSchema>;

    const agent = new Agent<undefined, Output>({
      model,
      outputSchema: OutputSchema,
    });

    const events = await collectEvents(agent.runStreamEvents("get value"));

    // Should NOT emit tool-call-result for final_result
    const toolCallResults = events.filter((e) => e.kind === "tool-call-result");
    assertEquals(toolCallResults.length, 0);

    // Should emit output-tool-call-result for final_result
    const outputCallResults = events.filter(
      (e) => e.kind === "output-tool-call-result",
    );
    assertEquals(outputCallResults.length, 1);

    const evt = outputCallResults[0] as {
      kind: "output-tool-call-result";
      toolCallId: string;
      toolName: string;
      result: unknown;
    };
    assertEquals(evt.toolName, "final_result");
    assertExists(evt.toolCallId);
  },
);

// ---------------------------------------------------------------------------
// Tests: function tools still emit tool-call-start / tool-call-result
// ---------------------------------------------------------------------------

Deno.test(
  "output tool events - function tools still emit tool-call-start and tool-call-result",
  async () => {
    const echoTool = tool({
      name: "echo",
      description: "Echo",
      parameters: z.object({ msg: z.string() }),
      execute: (_ctx, args: { msg: string }) => Promise.resolve(args.msg),
    });

    let turn = 0;
    const model = new MockLanguageModelV3({
      doStream: () => {
        turn++;
        return Promise.resolve(
          turn === 1
            ? toolCallStream("echo", { msg: "hello" })
            : textStream("done"),
        );
      },
    });

    const agent = new Agent({ model, tools: [echoTool] });
    const events = await collectEvents(agent.runStreamEvents("use echo"));

    // Function tool should emit regular tool-call-start
    const toolCallStarts = events.filter((e) => e.kind === "tool-call-start");
    assertEquals(toolCallStarts.length, 1);
    assertEquals(
      (toolCallStarts[0] as { kind: "tool-call-start"; toolName: string })
        .toolName,
      "echo",
    );

    // Function tool should emit regular tool-call-result
    const toolCallResults = events.filter((e) => e.kind === "tool-call-result");
    assertEquals(toolCallResults.length, 1);
    assertEquals(
      (toolCallResults[0] as { kind: "tool-call-result"; toolName: string })
        .toolName,
      "echo",
    );

    // No output tool events
    assertEquals(
      events.filter((e) => e.kind === "output-tool-call-start").length,
      0,
    );
    assertEquals(
      events.filter((e) => e.kind === "output-tool-call-result").length,
      0,
    );
  },
);

// ---------------------------------------------------------------------------
// Tests: isOutput (outputTool) emits output-tool-call-start / output-tool-call-result
// ---------------------------------------------------------------------------

Deno.test(
  "output tool events - outputTool() emits output-tool-call-start not tool-call-start",
  async () => {
    const submitTool = outputTool({
      name: "submit",
      description: "Submit the answer",
      parameters: z.object({ answer: z.string() }),
      execute: (_ctx, args: { answer: string }) => Promise.resolve(args.answer),
    });

    const model = new MockLanguageModelV3({
      doStream: () =>
        Promise.resolve(toolCallStream("submit", { answer: "42" })),
    });

    const agent = new Agent({ model, tools: [submitTool] });
    const events = await collectEvents(agent.runStreamEvents("submit answer"));

    // outputTool should emit output-tool-call-start, not tool-call-start
    const outputCallStarts = events.filter(
      (e) => e.kind === "output-tool-call-start",
    );
    assertEquals(outputCallStarts.length, 1);

    const evt = outputCallStarts[0] as {
      kind: "output-tool-call-start";
      toolName: string;
      toolCallId: string;
      args: Record<string, unknown>;
    };
    assertEquals(evt.toolName, "submit");

    // No regular tool-call-start
    assertEquals(events.filter((e) => e.kind === "tool-call-start").length, 0);
  },
);

Deno.test(
  "output tool events - outputTool() emits output-tool-call-result not tool-call-result",
  async () => {
    const submitTool = outputTool({
      name: "submit",
      description: "Submit the answer",
      parameters: z.object({ answer: z.string() }),
      execute: (_ctx, args: { answer: string }) => Promise.resolve(args.answer),
    });

    const model = new MockLanguageModelV3({
      doStream: () =>
        Promise.resolve(toolCallStream("submit", { answer: "42" })),
    });

    const agent = new Agent({ model, tools: [submitTool] });
    const events = await collectEvents(agent.runStreamEvents("submit answer"));

    const outputCallResults = events.filter(
      (e) => e.kind === "output-tool-call-result",
    );
    assertEquals(outputCallResults.length, 1);

    const evt = outputCallResults[0] as {
      kind: "output-tool-call-result";
      toolCallId: string;
      toolName: string;
      result: unknown;
    };
    assertEquals(evt.toolName, "submit");
    assertEquals(evt.result, "42");

    // No regular tool-call-result
    assertEquals(
      events.filter((e) => e.kind === "tool-call-result").length,
      0,
    );
  },
);

// ---------------------------------------------------------------------------
// Tests: mixed - function tool + final_result in same/adjacent turns
// ---------------------------------------------------------------------------

Deno.test(
  "output tool events - multi-turn: function tool then final_result emits correct events",
  async () => {
    const OutputSchema = z.object({ value: z.number() });

    const searchTool = tool({
      name: "search",
      description: "Search",
      parameters: z.object({ q: z.string() }),
      execute: (_ctx, args: { q: string }) => Promise.resolve(`result:${args.q}`),
    });

    let turn = 0;
    const model = new MockLanguageModelV3({
      doStream: () => {
        turn++;
        return Promise.resolve(
          turn === 1
            ? toolCallStream("search", { q: "hello" })
            : toolCallStream("final_result", { value: 99 }),
        );
      },
    });

    type Output = z.infer<typeof OutputSchema>;

    const agent = new Agent<undefined, Output>({
      model,
      tools: [searchTool],
      outputSchema: OutputSchema,
    });

    const events = await collectEvents(agent.runStreamEvents("get value"));

    // Turn 1: function tool events
    const toolCallStarts = events.filter((e) => e.kind === "tool-call-start");
    assertEquals(toolCallStarts.length, 1);
    assertEquals(
      (toolCallStarts[0] as { kind: "tool-call-start"; toolName: string })
        .toolName,
      "search",
    );

    // Turn 2: output tool events
    const outputCallStarts = events.filter(
      (e) => e.kind === "output-tool-call-start",
    );
    assertEquals(outputCallStarts.length, 1);
    assertEquals(
      (
        outputCallStarts[0] as {
          kind: "output-tool-call-start";
          toolName: string;
        }
      ).toolName,
      "final_result",
    );

    const outputCallResults = events.filter(
      (e) => e.kind === "output-tool-call-result",
    );
    assertEquals(outputCallResults.length, 1);

    // final-result still emitted
    const finalResults = events.filter((e) => e.kind === "final-result");
    assertEquals(finalResults.length, 1);
    assertEquals(
      (finalResults[0] as { kind: "final-result"; output: Output }).output
        .value,
      99,
    );
  },
);

// ---------------------------------------------------------------------------
// Tests: event ordering with output tool events
// ---------------------------------------------------------------------------

Deno.test(
  "output tool events - output-tool-call-start precedes output-tool-call-result",
  async () => {
    const OutputSchema = z.object({ value: z.number() });

    const model = new MockLanguageModelV3({
      doStream: () =>
        Promise.resolve(toolCallStream("final_result", { value: 1 })),
    });

    type Output = z.infer<typeof OutputSchema>;

    const agent = new Agent<undefined, Output>({
      model,
      outputSchema: OutputSchema,
    });

    const events = await collectEvents(agent.runStreamEvents("prompt"));

    const startIdx = events.findIndex(
      (e) => e.kind === "output-tool-call-start",
    );
    const resultIdx = events.findIndex(
      (e) => e.kind === "output-tool-call-result",
    );
    const finalIdx = events.findIndex((e) => e.kind === "final-result");

    assertExists(startIdx >= 0 ? startIdx : undefined);
    assertExists(resultIdx >= 0 ? resultIdx : undefined);
    assertEquals(startIdx < resultIdx, true);
    assertEquals(resultIdx < finalIdx, true);
  },
);
