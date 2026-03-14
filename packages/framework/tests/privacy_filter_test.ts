import { assertEquals } from "@std/assert";
import { privacyFilterProcessor } from "../mod.ts";
import type { ModelMessage } from "ai";

function userMsg(text: string): ModelMessage {
	return { role: "user", content: text };
}

function assistantMsg(text: string): ModelMessage {
	return { role: "assistant", content: text };
}

Deno.test("privacyFilterProcessor - no-op with empty rules", async () => {
	const processor = privacyFilterProcessor([]);
	const messages: ModelMessage[] = [userMsg("hello"), assistantMsg("world")];
	const result = await Promise.resolve(processor(messages, {} as never));
	assertEquals(result, messages);
});

Deno.test("privacyFilterProcessor - regex replaces matched text in user messages", async () => {
	const processor = privacyFilterProcessor([
		{ pattern: /\d{4}-\d{4}-\d{4}-\d{4}/, replacement: "[CARD]" },
	]);
	const messages: ModelMessage[] = [
		userMsg("My card is 1234-5678-9012-3456 please charge it."),
	];
	const result = await Promise.resolve(processor(messages, {} as never));
	assertEquals(
		(result[0] as { role: "user"; content: string }).content,
		"My card is [CARD] please charge it.",
	);
});

Deno.test("privacyFilterProcessor - uses [REDACTED] as default replacement", async () => {
	const processor = privacyFilterProcessor([
		{ pattern: /secret/ },
	]);
	const messages: ModelMessage[] = [userMsg("this is secret info")];
	const result = await Promise.resolve(processor(messages, {} as never));
	assertEquals(
		(result[0] as { role: "user"; content: string }).content,
		"this is [REDACTED] info",
	);
});

Deno.test("privacyFilterProcessor - regex applied to assistant messages", async () => {
	const processor = privacyFilterProcessor([
		{ pattern: /password=\S+/, replacement: "password=[REDACTED]" },
	]);
	const messages: ModelMessage[] = [
		assistantMsg("Use: password=hunter2 to login"),
	];
	const result = await Promise.resolve(processor(messages, {} as never));
	assertEquals(
		(result[0] as { role: "assistant"; content: string }).content,
		"Use: password=[REDACTED] to login",
	);
});

Deno.test("privacyFilterProcessor - does not mutate original messages", async () => {
	const processor = privacyFilterProcessor([
		{ pattern: /secret/, replacement: "[HIDDEN]" },
	]);
	const original = "my secret data";
	const messages: ModelMessage[] = [userMsg(original)];
	await Promise.resolve(processor(messages, {} as never));
	// Original message content is unchanged
	assertEquals(
		(messages[0] as { role: "user"; content: string }).content,
		original,
	);
});

Deno.test("privacyFilterProcessor - multiple rules applied in order", async () => {
	const processor = privacyFilterProcessor([
		{ pattern: /foo/, replacement: "bar" },
		{ pattern: /bar/, replacement: "baz" },
	]);
	const messages: ModelMessage[] = [userMsg("foo")];
	const result = await Promise.resolve(processor(messages, {} as never));
	// foo -> bar -> baz
	assertEquals(
		(result[0] as { role: "user"; content: string }).content,
		"baz",
	);
});

Deno.test("privacyFilterProcessor - regex applied to array content text parts", async () => {
	const processor = privacyFilterProcessor([
		{ pattern: /secret/, replacement: "[HIDDEN]" },
	]);
	const messages: ModelMessage[] = [
		{
			role: "user",
			content: [{ type: "text", text: "my secret here" }],
		},
	];
	const result = await Promise.resolve(processor(messages, {} as never));
	const content = result[0].content;
	if (Array.isArray(content) && content[0] && typeof content[0] === "object" && "text" in content[0]) {
		assertEquals((content[0] as { type: string; text: string }).text, "my secret here".replace("secret", "[HIDDEN]"));
	}
});

Deno.test("privacyFilterProcessor - field rule removes field from matching role", async () => {
	const processor = privacyFilterProcessor([
		{ messageType: "user", fieldPath: "1" },
	]);
	const messages: ModelMessage[] = [
		{
			role: "user",
			content: [
				{ type: "text", text: "keep me" },
				{ type: "text", text: "remove me" },
			],
		},
	];
	const result = await Promise.resolve(processor(messages, {} as never));
	const content = result[0].content;
	if (Array.isArray(content)) {
		assertEquals(content.length, 1);
		assertEquals((content[0] as { type: string; text: string }).text, "keep me");
	}
});

Deno.test("privacyFilterProcessor - field rule does not affect other roles", async () => {
	const processor = privacyFilterProcessor([
		{ messageType: "assistant", fieldPath: "0" },
	]);
	const messages: ModelMessage[] = [
		{ role: "user", content: "untouched" },
	];
	const result = await Promise.resolve(processor(messages, {} as never));
	assertEquals(result[0].content, "untouched");
});

Deno.test("privacyFilterProcessor - global regex flag replaces all occurrences", async () => {
	const processor = privacyFilterProcessor([
		{ pattern: /\d+/g, replacement: "[NUM]" },
	]);
	const messages: ModelMessage[] = [userMsg("I have 3 cats and 5 dogs")];
	const result = await Promise.resolve(processor(messages, {} as never));
	assertEquals(
		(result[0] as { role: "user"; content: string }).content,
		"I have [NUM] cats and [NUM] dogs",
	);
});
