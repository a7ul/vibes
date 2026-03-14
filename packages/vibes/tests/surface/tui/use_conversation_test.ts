import { assertEquals } from "@std/assert";
import type { ConversationEntry } from "../../../src/surface/tui/types.ts";

// Pure logic tests for conversation entry management
// These mirror patterns in useVibesAgent.

function addUserEntry(entries: ConversationEntry[], content: string): ConversationEntry[] {
  return [...entries, { kind: "user", id: crypto.randomUUID(), content }];
}

function addAssistantEntry(entries: ConversationEntry[]): ConversationEntry[] {
  return [
    ...entries,
    { kind: "assistant", id: crypto.randomUUID(), items: [], status: "streaming" },
  ];
}

Deno.test("conversation - addUserEntry creates user entry with correct content", () => {
  const result = addUserEntry([], "hello");
  assertEquals(result.length, 1);
  const entry = result[0];
  assertEquals(entry.kind, "user");
  if (entry.kind !== "user") return;
  assertEquals(entry.content, "hello");
});

Deno.test("conversation - addUserEntry is immutable", () => {
  const original: ConversationEntry[] = [];
  const updated = addUserEntry(original, "hi");
  assertEquals(original.length, 0);
  assertEquals(updated.length, 1);
});

Deno.test("conversation - addAssistantEntry starts with streaming status", () => {
  const result = addAssistantEntry([]);
  assertEquals(result.length, 1);
  const entry = result[0];
  assertEquals(entry.kind, "assistant");
  if (entry.kind !== "assistant") return;
  assertEquals(entry.status, "streaming");
  assertEquals(entry.items.length, 0);
});

Deno.test("conversation - multiple entries preserve order", () => {
  let entries: ConversationEntry[] = [];
  entries = addUserEntry(entries, "first");
  entries = addAssistantEntry(entries);
  entries = addUserEntry(entries, "second");
  entries = addAssistantEntry(entries);

  assertEquals(entries.length, 4);
  assertEquals(entries[0].kind, "user");
  assertEquals(entries[1].kind, "assistant");
  assertEquals(entries[2].kind, "user");
  assertEquals(entries[3].kind, "assistant");
});

Deno.test("conversation - entries have unique ids", () => {
  let entries: ConversationEntry[] = [];
  entries = addUserEntry(entries, "a");
  entries = addUserEntry(entries, "b");
  const ids = entries.map((e) => e.id);
  assertEquals(new Set(ids).size, ids.length);
});
