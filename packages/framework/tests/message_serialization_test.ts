import { assertEquals, assertThrows } from "@std/assert";
import { serializeMessages, deserializeMessages } from "../mod.ts";
import type { ModelMessage } from "ai";

function userMsg(text: string): ModelMessage {
	return { role: "user", content: text };
}

function assistantMsg(text: string): ModelMessage {
	return { role: "assistant", content: text };
}

Deno.test("serializeMessages - produces valid JSON string", () => {
	const messages: ModelMessage[] = [userMsg("hello"), assistantMsg("world")];
	const json = serializeMessages(messages);
	const parsed = JSON.parse(json);
	assertEquals(Array.isArray(parsed), true);
	assertEquals(parsed.length, 2);
});

Deno.test("serializeMessages - empty array produces '[]'", () => {
	assertEquals(serializeMessages([]), "[]");
});

Deno.test("deserializeMessages - round-trips messages correctly", () => {
	const messages: ModelMessage[] = [
		userMsg("first"),
		assistantMsg("second"),
		{ role: "system", content: "system prompt" },
	];
	const json = serializeMessages(messages);
	const restored = deserializeMessages(json);
	assertEquals(restored, messages);
});

Deno.test("deserializeMessages - empty JSON array returns empty array", () => {
	assertEquals(deserializeMessages("[]"), []);
});

Deno.test("deserializeMessages - throws SyntaxError on invalid JSON", () => {
	assertThrows(
		() => deserializeMessages("not json"),
		SyntaxError,
	);
});

Deno.test("deserializeMessages - throws TypeError when JSON is not an array", () => {
	assertThrows(
		() => deserializeMessages('{"role": "user", "content": "oops"}'),
		TypeError,
		"expected a JSON array",
	);
});

Deno.test("deserializeMessages - preserves array content messages", () => {
	const messages: ModelMessage[] = [
		{
			role: "user",
			content: [
				{ type: "text", text: "describe this" },
			],
		},
	];
	const restored = deserializeMessages(serializeMessages(messages));
	assertEquals(restored, messages);
});

Deno.test("serializeMessages / deserializeMessages - idempotent on double round-trip", () => {
	const messages: ModelMessage[] = [userMsg("idempotent"), assistantMsg("yes")];
	const first = deserializeMessages(serializeMessages(messages));
	const second = deserializeMessages(serializeMessages(first));
	assertEquals(second, messages);
});
