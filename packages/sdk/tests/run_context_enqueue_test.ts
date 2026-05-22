import { assertEquals } from "@std/assert";
import { z } from "zod";
import { Agent, tool } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

Deno.test("RunContext.enqueue - queued messages are added before the next turn", async () => {
  const capturedMessagesByTurn: unknown[][] = [];
  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("queue_note", { note: "remember this" }),
    textResponse("done"),
  );

  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedMessagesByTurn.push(
        ((opts as Record<string, unknown>).messages as unknown[]) ?? [],
      );
      return Promise.resolve(responses());
    },
  });

  const queueTool = tool({
    name: "queue_note",
    description: "Queue context for the next turn",
    parameters: z.object({ note: z.string() }),
    execute: (ctx, args) => {
      ctx.enqueue({
        role: "assistant",
        content: [{ type: "text", text: `queued:${args.note}` }],
      });
      return Promise.resolve("queued");
    },
  });

  const agent = new Agent({
    model,
    tools: [queueTool],
  });

  await agent.run("queue a note");

  assertEquals(capturedMessagesByTurn.length, 2);
  assertEquals(
    JSON.stringify(capturedMessagesByTurn[1]).includes("queued:remember this"),
    true,
  );
});
