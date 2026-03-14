import type { ModelMessage } from "ai";

/**
 * Serialize a list of model messages to a JSON string.
 *
 * `ModelMessage` (aka `CoreMessage`) from the AI SDK is already fully
 * JSON-serializable - this function provides a typed, named wrapper so
 * callers don't have to cast manually.
 *
 * @example
 * ```ts
 * const json = serializeMessages(result.messages);
 * localStorage.setItem("history", json);
 * ```
 */
export function serializeMessages(messages: ModelMessage[]): string {
  return JSON.stringify(messages);
}

/**
 * Deserialize a JSON string produced by `serializeMessages` back into a typed
 * `ModelMessage[]` array. Throws a `SyntaxError` if the input is not valid JSON,
 * or a `TypeError` if the parsed value is not an array.
 *
 * @example
 * ```ts
 * const history = deserializeMessages(localStorage.getItem("history") ?? "[]");
 * await agent.run("continue", { messageHistory: history });
 * ```
 */
export function deserializeMessages(json: string): ModelMessage[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new TypeError(
      `deserializeMessages: expected a JSON array, got ${typeof parsed}`,
    );
  }
  return parsed as ModelMessage[];
}
