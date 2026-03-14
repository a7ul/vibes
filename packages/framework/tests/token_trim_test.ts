import { assertEquals } from "@std/assert";
import { tokenTrimHistoryProcessor } from "../mod.ts";
import type { ModelMessage } from "ai";

function userMsg(text: string): ModelMessage {
  return { role: "user", content: text };
}

function assistantMsg(text: string): ModelMessage {
  return { role: "assistant", content: text };
}

function systemMsg(text: string): ModelMessage {
  return { role: "system", content: text };
}

// A deterministic token counter: each message has exactly `content.length` tokens.
function charCounter(msg: ModelMessage): number {
  return typeof msg.content === "string" ? msg.content.length : 100;
}

Deno.test("tokenTrimHistoryProcessor - no-op when under budget", async () => {
  const processor = tokenTrimHistoryProcessor(1000, charCounter);
  const messages: ModelMessage[] = [userMsg("hello"), assistantMsg("world")];
  const result = await Promise.resolve(processor(messages, {} as never));
  assertEquals(result, messages);
});

Deno.test("tokenTrimHistoryProcessor - trims oldest non-system messages first", async () => {
  // Budget: 2 chars. Recent "cc"(2) fits; older messages are dropped.
  const processor = tokenTrimHistoryProcessor(2, charCounter);
  const messages: ModelMessage[] = [
    userMsg("aaaaaaaaa"), // 9 chars
    assistantMsg("bbbbbbbbb"), // 9 chars
    userMsg("cc"), // 2 chars
  ];
  const result = await Promise.resolve(processor(messages, {} as never));
  // Only the last message fits within 2-char budget
  assertEquals(result, [userMsg("cc")]);
});

Deno.test("tokenTrimHistoryProcessor - always preserves system messages", async () => {
  // Budget: 5 chars total. System is "sys"(3), leaving 2 for non-system.
  // Only "hi"(2) fits.
  const processor = tokenTrimHistoryProcessor(5, charCounter);
  const messages: ModelMessage[] = [
    systemMsg("sys"),
    userMsg("removed"), // 7 chars — won't fit
    assistantMsg("hi"), // 2 chars — fits
  ];
  const result = await Promise.resolve(processor(messages, {} as never));
  assertEquals(result, [systemMsg("sys"), assistantMsg("hi")]);
});

Deno.test("tokenTrimHistoryProcessor - returns empty non-system when nothing fits", async () => {
  // Budget: 3 chars. System "abc"(3) fills it completely.
  // Non-system messages get zero budget.
  const processor = tokenTrimHistoryProcessor(3, charCounter);
  const messages: ModelMessage[] = [
    systemMsg("abc"),
    userMsg("x"),
  ];
  const result = await Promise.resolve(processor(messages, {} as never));
  assertEquals(result, [systemMsg("abc")]);
});

Deno.test("tokenTrimHistoryProcessor - uses default token counter", async () => {
  // Verify the default counter (JSON length / 4) doesn't crash.
  const processor = tokenTrimHistoryProcessor(10000);
  const messages: ModelMessage[] = [
    userMsg("short"),
    assistantMsg("also short"),
  ];
  const result = await Promise.resolve(processor(messages, {} as never));
  // Under a generous budget both messages should survive.
  assertEquals(result, messages);
});

Deno.test("tokenTrimHistoryProcessor - does not mutate the original array", async () => {
  const processor = tokenTrimHistoryProcessor(2, charCounter);
  const messages: ModelMessage[] = [userMsg("long-message"), userMsg("hi")];
  const original = [...messages];
  await Promise.resolve(processor(messages, {} as never));
  assertEquals(messages, original);
});

Deno.test("tokenTrimHistoryProcessor - multiple system messages all preserved", async () => {
  // Two system messages "aa"(2) + "bb"(2) = 4, budget = 10, so 6 left for non-system.
  // "123456"(6) fits exactly.
  const processor = tokenTrimHistoryProcessor(10, charCounter);
  const messages: ModelMessage[] = [
    systemMsg("aa"),
    systemMsg("bb"),
    userMsg("removed!!!"), // 10 chars — won't fit in remaining 6
    userMsg("123456"), // 6 chars — fits
  ];
  const result = await Promise.resolve(processor(messages, {} as never));
  assertEquals(result, [systemMsg("aa"), systemMsg("bb"), userMsg("123456")]);
});
