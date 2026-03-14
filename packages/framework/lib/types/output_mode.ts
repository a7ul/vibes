/**
 * Controls how structured output is delivered to the model.
 *
 * - `'tool'` (default): Inject a `final_result` tool the model must call.
 *   Supports union schemas (registers `final_result_0`, `final_result_1`, etc.).
 * - `'native'`: Use the AI SDK's native structured-output / JSON mode.
 *   The model's `object` response field is parsed against the schema.
 * - `'prompted'`: Inject the JSON schema into the system prompt as instructions.
 *   The model's text response is parsed as JSON against the schema.
 */
export type OutputMode = "tool" | "native" | "prompted";
