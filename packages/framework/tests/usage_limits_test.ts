import { assertEquals, assertRejects } from "@std/assert";
import { Agent } from "../mod.ts";
import { UsageLimitError } from "../errors.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";
import { z } from "zod";

Deno.test("UsageLimits - maxRequests=1 throws on second turn within a run", async () => {
  // Run with maxRequests:1 — after 1 model call, the next turn's pre-check should throw
  const Schema = z.object({ answer: z.string() });
  // Model never returns final_result, forcing multiple turns
  const model = new MockLanguageModelV3({
    doGenerate: textResponse("no tool call here"),
  });

  const agent = new Agent<undefined, z.infer<typeof Schema>>({
    model,
    outputSchema: Schema,
    maxRetries: 5,
    usageLimits: { maxRequests: 1 },
  });

  // First turn succeeds; on the second turn (nudge for final_result), pre-check throws
  await assertRejects(
    () => agent.run("give me structured output"),
    UsageLimitError,
    "requests",
  );
});

Deno.test("UsageLimits - maxRequests=2 allows two turns then throws on third", async () => {
  const Schema = z.object({ answer: z.string() });
  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(textResponse("no final_result"));
    },
  });

  const agent = new Agent<undefined, z.infer<typeof Schema>>({
    model,
    outputSchema: Schema,
    maxRetries: 5,
    usageLimits: { maxRequests: 2 },
  });

  await assertRejects(
    () => agent.run("go"),
    UsageLimitError,
    "requests",
  );
  assertEquals(callCount, 2); // exactly 2 model calls before limit kicks in
});

Deno.test("UsageLimits - per-run override limits turns within that run", async () => {
  const Schema = z.object({ answer: z.string() });
  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(textResponse("no final_result"));
    },
  });

  // Agent has no limits, but per-run limit of 1
  const agent = new Agent<undefined, z.infer<typeof Schema>>({
    model,
    outputSchema: Schema,
    maxRetries: 5,
  });

  await assertRejects(
    () => agent.run("go", { usageLimits: { maxRequests: 1 } }),
    UsageLimitError,
  );
  assertEquals(callCount, 1);
});

Deno.test("UsageLimits - override trumps agent-level limit", async () => {
  const Schema = z.object({ answer: z.string() });
  let callCount = 0;
  const responses = mockValues<DoGenerateResult>(
    textResponse("no final_result"),
    textResponse("no final_result"),
    toolCallResponse("final_result", { answer: "yes" }),
  );
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(responses());
    },
  });

  // Agent limit: 1 request, but override raises it to 5
  const agent = new Agent<undefined, z.infer<typeof Schema>>({
    model,
    outputSchema: Schema,
    maxRetries: 5,
    usageLimits: { maxRequests: 1 },
  });

  const result = await agent
    .override({ usageLimits: { maxRequests: 5 } })
    .run("go");
  assertEquals(result.output.answer, "yes");
  assertEquals(callCount, 3);
});
