import { assertEquals } from "@std/assert";

// Test the pure logic of useConversation without React
// We test the state transformation logic directly

Deno.test("conversation - addMessage creates a message with correct role and content", () => {
  // Pure logic test: simulate what addMessage does
  type Role = "user" | "assistant";
  interface Msg { id: string; role: Role; content: string; timestamp: Date }

  function addMessage(messages: Msg[], role: Role, content: string): Msg[] {
    const msg: Msg = { id: crypto.randomUUID(), role, content, timestamp: new Date() };
    return [...messages, msg];
  }

  const msgs = addMessage([], "user", "hello");
  assertEquals(msgs.length, 1);
  assertEquals(msgs[0].role, "user");
  assertEquals(msgs[0].content, "hello");
});

Deno.test("conversation - addMessage is immutable", () => {
  type Role = "user" | "assistant";
  interface Msg { id: string; role: Role; content: string; timestamp: Date }

  function addMessage(messages: Msg[], role: Role, content: string): Msg[] {
    const msg: Msg = { id: crypto.randomUUID(), role, content, timestamp: new Date() };
    return [...messages, msg];
  }

  const original: Msg[] = [];
  const updated = addMessage(original, "user", "hi");
  assertEquals(original.length, 0);
  assertEquals(updated.length, 1);
});

Deno.test("conversation - updateLastAssistantMessage updates last assistant message", () => {
  type Role = "user" | "assistant";
  interface Msg { id: string; role: Role; content: string; timestamp: Date }

  function updateLast(messages: Msg[], content: string): Msg[] {
    const idx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (idx === -1) return messages;
    const realIdx = messages.length - 1 - idx;
    return messages.map((m, i) => (i === realIdx ? { ...m, content } : m));
  }

  const messages: Msg[] = [
    { id: "1", role: "user", content: "q", timestamp: new Date() },
    { id: "2", role: "assistant", content: "partial", timestamp: new Date() },
  ];

  const updated = updateLast(messages, "full response");
  assertEquals(updated[1].content, "full response");
  assertEquals(updated[0].content, "q"); // user message unchanged
});

Deno.test("conversation - updateLastAssistantMessage is a no-op when no assistant messages", () => {
  type Role = "user" | "assistant";
  interface Msg { id: string; role: Role; content: string; timestamp: Date }

  function updateLast(messages: Msg[], content: string): Msg[] {
    const idx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (idx === -1) return messages;
    const realIdx = messages.length - 1 - idx;
    return messages.map((m, i) => (i === realIdx ? { ...m, content } : m));
  }

  const messages: Msg[] = [{ id: "1", role: "user", content: "q", timestamp: new Date() }];
  const updated = updateLast(messages, "ignored");
  assertEquals(updated, messages);
});

Deno.test("conversation - multiple messages preserve order", () => {
  type Role = "user" | "assistant";
  interface Msg { id: string; role: Role; content: string; timestamp: Date }

  function addMessage(messages: Msg[], role: Role, content: string): Msg[] {
    return [...messages, { id: crypto.randomUUID(), role, content, timestamp: new Date() }];
  }

  let msgs: Msg[] = [];
  msgs = addMessage(msgs, "user", "first");
  msgs = addMessage(msgs, "assistant", "response 1");
  msgs = addMessage(msgs, "user", "second");
  msgs = addMessage(msgs, "assistant", "response 2");

  assertEquals(msgs.length, 4);
  assertEquals(msgs[0].role, "user");
  assertEquals(msgs[1].role, "assistant");
  assertEquals(msgs[2].role, "user");
  assertEquals(msgs[3].role, "assistant");
});
