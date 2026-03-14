/**
 * Helpers for converting between `ModelMessage[]` (AI SDK) and the
 * JSON-serializable `SerializableMessage[]` format required by Temporal
 * workflow payloads.
 *
 * `ModelMessage` from the Vercel AI SDK is already fully JSON-serializable, so
 * these helpers are thin wrappers that make the intent explicit and provide
 * type-safe round-tripping across the Temporal workflow/activity boundary.
 */

import type { ModelMessage } from "ai";
import type { SerializableMessage } from "./types.ts";

/**
 * Convert an array of AI SDK `ModelMessage` objects into the
 * `SerializableMessage[]` format used in Temporal activity parameters and
 * workflow state.
 *
 * The conversion is a structural cast — `ModelMessage` is already
 * JSON-serializable. The function validates that each message has a `role`
 * field and a `content` field before casting.
 *
 * @param messages - The messages to serialize.
 * @returns A new array of {@link SerializableMessage} objects.
 */
export function serializeRunState(messages: ModelMessage[]): SerializableMessage[] {
	return messages.map((msg) => {
		// ModelMessage is a discriminated union keyed on `role`.
		// We assert via structural check that required fields exist.
		const raw = msg as Record<string, unknown>;
		const role = raw["role"];
		const content = raw["content"];

		if (typeof role !== "string") {
			throw new TypeError(
				`serializeRunState: message missing 'role' field (got ${typeof role})`,
			);
		}
		if (content === undefined) {
			throw new TypeError(
				`serializeRunState: message with role '${role}' is missing 'content'`,
			);
		}

		// Validate content is a primitive string or an array (both are serializable)
		if (typeof content !== "string" && !Array.isArray(content)) {
			throw new TypeError(
				`serializeRunState: message content must be a string or array, got ${typeof content}`,
			);
		}

		return { role, content } as SerializableMessage;
	});
}

/**
 * Convert `SerializableMessage[]` back into the AI SDK `ModelMessage[]`
 * format. Validates each entry has a `role` and `content` before casting.
 *
 * Note: This performs a structural cast. If the serialized data was produced
 * by a different version of the AI SDK, additional field validation may be
 * needed.
 *
 * @param messages - The serialized messages to deserialize.
 * @returns A new array of `ModelMessage` objects.
 */
export function deserializeRunState(messages: SerializableMessage[]): ModelMessage[] {
	return messages.map((msg) => {
		if (typeof msg.role !== "string") {
			throw new TypeError(
				`deserializeRunState: message missing 'role' field`,
			);
		}
		if (msg.content === undefined || msg.content === null) {
			throw new TypeError(
				`deserializeRunState: message with role '${msg.role}' missing 'content'`,
			);
		}
		// Safe cast: SerializableMessage is a structural subset of ModelMessage
		return msg as unknown as ModelMessage;
	});
}

/**
 * Round-trip a `ModelMessage[]` through the serializable format and back.
 * Useful for testing that a message array survives Temporal payload encoding.
 *
 * @param messages - Messages to round-trip.
 * @returns Deserialized copy of the messages.
 */
export function roundTripMessages(messages: ModelMessage[]): ModelMessage[] {
	return deserializeRunState(serializeRunState(messages));
}
