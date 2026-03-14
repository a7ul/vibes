import { useState, useCallback } from "react";
import type { TuiMessage } from "../types.ts";

export interface UseConversationResult {
  messages: TuiMessage[];
  addMessage: (role: TuiMessage["role"], content: string) => TuiMessage;
  updateLastAssistantMessage: (content: string) => void;
}

export function useConversation(): UseConversationResult {
  const [messages, setMessages] = useState<TuiMessage[]>([]);

  const addMessage = useCallback((role: TuiMessage["role"], content: string): TuiMessage => {
    const msg: TuiMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const lastIdx = prev.findLastIndex((m) => m.role === "assistant");
      if (lastIdx === -1) return prev;
      return prev.map((m, i) => (i === lastIdx ? { ...m, content } : m));
    });
  }, []);

  return { messages, addMessage, updateLastAssistantMessage };
}
