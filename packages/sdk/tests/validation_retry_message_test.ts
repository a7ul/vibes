/**
 * Tests ported from pydantic-ai v1.85.1 bug fix:
 * - fix: exclude validation error `input` from retry messages
 *
 * In pydantic-ai (Python), `RetryPromptPart.model_response()` was updated to
 * strip the `input` field from top-level Pydantic validation errors. The `input`
 * field in pydantic-core error details contains the entire object being validated,
 * which for top-level errors duplicates the full generated output — potentially
 * large and noisy.
 *
 * In vibes (TypeScript + Zod), this issue does not exist because Zod's
 * `ZodError.issues` never includes the raw input value. These tests verify
 * that the retry message sent back to the model:
 *   1. contains enough information for the model to fix its output (field
 *      paths, error descriptions), and
 *   2. does NOT contain the raw input data that triggered the error.
 *
 * The relevant code paths are:
 * - `nudgeWithValidationError` in `lib/execution/run.ts` — called on schema
 *   validation failure in prompted output mode, and on result-validator rejection.
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { Agent } from "../mod.ts";
import { z } from "zod";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// Helper: extract text from an AI SDK message content part (string or array).
// In AI SDK v6 user messages have content typed as
//   string | Array<{ type: "text"; text: string } | ...>
// ---------------------------------------------------------------------------

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (
          part !== null &&
          typeof part === "object" &&
          (part as { type?: string }).type === "text"
        ) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Helper: capture all user-role message texts sent to the model
// ---------------------------------------------------------------------------

function makeCapturingModel(
  responses: () => DoGenerateResult,
): {
  model: MockLanguageModelV3;
  userMessageTexts: string[];
} {
  const userMessageTexts: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      for (const msg of opts.prompt) {
        if (
          msg !== null &&
          typeof msg === "object" &&
          (msg as { role?: string }).role === "user"
        ) {
          const text = extractTextFromContent(
            (msg as { content?: unknown }).content,
          );
          userMessageTexts.push(text);
        }
      }
      return Promise.resolve(responses());
    },
  });
  return { model, userMessageTexts };
}

// ---------------------------------------------------------------------------
// Port of test_retry_prompt_strips_input_from_top_level_errors
// (prompted output mode — nudgeWithValidationError is called with the ZodError)
// ---------------------------------------------------------------------------

Deno.test(
  "prompted: retry message contains field name but NOT the raw input value",
  async () => {
    const OutputSchema = z.object({ name: z.string(), capital: z.string() });

    // This sentinel value is in the model's first (invalid) response and must
    // NOT appear in any message vibes sends back to the model.
    const inputSentinel = "SHOULD_NOT_APPEAR_9f3e";

    const responses = mockValues<DoGenerateResult>(
      // Turn 1: JSON is missing the required `capital` field.
      textResponse(JSON.stringify({ name: inputSentinel, extraKey: "ignore" })),
      // Turn 2: correct JSON.
      textResponse(JSON.stringify({ name: "France", capital: "Paris" })),
    );

    const { model, userMessageTexts } = makeCapturingModel(() => responses());

    const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
      model,
      outputMode: "prompted",
      outputSchema: OutputSchema,
      maxRetries: 3,
    });

    const result = await agent.run("Capital of France?");
    assertEquals(result.output.capital, "Paris");
    assertEquals(result.retryCount, 1);

    // Find the retry nudge message added by nudgeWithValidationError.
    const retryMsg = userMessageTexts.find((m) =>
      m.includes("Result validation failed")
    );
    assertExists(retryMsg, "should have a retry message");

    // The failing field path ("capital") must be mentioned.
    assertStringIncludes(
      retryMsg,
      "capital",
      "retry message should reference the failing field path",
    );

    // The raw input value from the first response MUST NOT appear in any
    // message sent to the model. This is the core property verified by the
    // pydantic-ai v1.85.1 fix; vibes satisfies it inherently via Zod's
    // error format, which never embeds the input object in issue details.
    const allMessages = userMessageTexts.join(" ");
    assertEquals(
      allMessages.includes(inputSentinel),
      false,
      "retry message must not leak the raw input sentinel value",
    );
  },
);

// ---------------------------------------------------------------------------
// Port of test_retry_prompt_strips_input_from_top_level_type_errors
// (type mismatch: Zod reports the received TYPE ("string"), not the value)
// ---------------------------------------------------------------------------

Deno.test(
  "prompted: retry message for type mismatch reports type name, not actual value",
  async () => {
    const OutputSchema = z.object({ count: z.number() });

    // Secret value that must not leak into retry messages.
    const secretValue = "MY_SECRET_INPUT_VALUE";

    const responses = mockValues<DoGenerateResult>(
      // Turn 1: string where a number is expected.
      textResponse(JSON.stringify({ count: secretValue })),
      // Turn 2: correct number.
      textResponse(JSON.stringify({ count: 42 })),
    );

    const { model, userMessageTexts } = makeCapturingModel(() => responses());

    const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
      model,
      outputMode: "prompted",
      outputSchema: OutputSchema,
      maxRetries: 3,
    });

    const result = await agent.run("Count something");
    assertEquals(result.output.count, 42);
    assertEquals(result.retryCount, 1);

    const retryMsg = userMessageTexts.find((m) =>
      m.includes("Result validation failed")
    );
    assertExists(retryMsg, "should have a retry message");

    // The field path ("count") must be present.
    assertStringIncludes(retryMsg, "count");

    // Zod reports "received string" (the TYPE name), not "MY_SECRET_INPUT_VALUE".
    const allMessages = userMessageTexts.join(" ");
    assertEquals(
      allMessages.includes(secretValue),
      false,
      "retry message must not include the actual received value, only the type name",
    );
  },
);

// ---------------------------------------------------------------------------
// Result validator path: validator error message is used, not the raw output
// ---------------------------------------------------------------------------

Deno.test(
  "result validator: retry message contains validator error, not raw output value",
  async () => {
    const OutputSchema = z.object({ score: z.number() });
    type Output = z.infer<typeof OutputSchema>;

    const sentinelScore = 999_999;

    const responses = mockValues<DoGenerateResult>(
      // Turn 1: valid JSON but fails the custom validator.
      toolCallResponse("final_result", { score: sentinelScore }),
      // Turn 2: passes validator.
      toolCallResponse("final_result", { score: 5 }),
    );

    const { model, userMessageTexts } = makeCapturingModel(() => responses());

    const agent = new Agent<undefined, Output>({
      model,
      outputSchema: OutputSchema,
      maxRetries: 3,
      resultValidators: [
        (_ctx, output: Output): Output => {
          if (output.score > 10) throw new Error("Score must be 1-10");
          return output;
        },
      ],
    });

    const result = await agent.run("Give me a score");
    assertEquals(result.output.score, 5);
    assertEquals(result.retryCount, 1);

    const retryMsg = userMessageTexts.find((m) =>
      m.includes("Result validation failed")
    );
    assertExists(retryMsg, "should have a retry message");

    // The validator's error message must be present.
    assertStringIncludes(retryMsg, "Score must be 1-10");

    // The validator did not include the numeric value in its message,
    // so it should not appear in any message sent to the model.
    assertEquals(
      userMessageTexts.join(" ").includes(String(sentinelScore)),
      false,
      "retry message should not include the raw output value unless the validator puts it there",
    );
  },
);

// ---------------------------------------------------------------------------
// Verify Zod never embeds the full input in error details (nested object)
// ---------------------------------------------------------------------------

Deno.test(
  "prompted: nested Zod error reports field path but not the input object",
  async () => {
    const OutputSchema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const nestedSentinel = "NESTED_SECRET_VALUE_abc123";

    const responses = mockValues<DoGenerateResult>(
      // Turn 1: correct name but wrong type for nested `age` field.
      textResponse(
        JSON.stringify({ user: { name: nestedSentinel, age: "not_a_number" } }),
      ),
      // Turn 2: correct.
      textResponse(JSON.stringify({ user: { name: "Alice", age: 30 } })),
    );

    const { model, userMessageTexts } = makeCapturingModel(() => responses());

    const agent = new Agent<undefined, z.infer<typeof OutputSchema>>({
      model,
      outputMode: "prompted",
      outputSchema: OutputSchema,
      maxRetries: 3,
    });

    const result = await agent.run("Get user");
    assertEquals(result.output.user.name, "Alice");
    assertEquals(result.retryCount, 1);

    const retryMsg = userMessageTexts.find((m) =>
      m.includes("Result validation failed")
    );
    assertExists(retryMsg, "should have a retry message");

    // Field path info should be present.
    assertStringIncludes(retryMsg, "age");

    // The sentinel name value must not appear in any message sent to the model.
    const allMessages = userMessageTexts.join(" ");
    assertEquals(
      allMessages.includes(nestedSentinel),
      false,
      "retry message must not include the nested input sentinel value",
    );
  },
);
