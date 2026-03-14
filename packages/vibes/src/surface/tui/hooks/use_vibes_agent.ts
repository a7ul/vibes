import { useState, useCallback, useRef } from "react";
import type { Agent, Usage } from "@vibes/framework";
import type { CoreAgentDeps, CoreAgentOutput } from "../../../types.ts";
import type { ConversationEntry, TurnItem, AgentSessionState } from "../types.ts";

export interface UseVibesAgentResult {
  entries: ConversationEntry[];
  send: (prompt: string, deps: CoreAgentDeps) => Promise<void>;
  abort: () => void;
  state: AgentSessionState;
  usage: Usage | null;
  currentTurn: number;
  error: string | null;
}

export function useVibesAgent(
  agent: Agent<CoreAgentDeps, CoreAgentOutput>,
): UseVibesAgentResult {
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [state, setState] = useState<AgentSessionState>("idle");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (prompt: string, deps: CoreAgentDeps) => {
      if (state === "streaming") return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userEntry: ConversationEntry = {
        kind: "user",
        id: crypto.randomUUID(),
        content: prompt,
      };
      const assistantId = crypto.randomUUID();
      const assistantEntry: ConversationEntry = {
        kind: "assistant",
        id: assistantId,
        items: [],
        status: "streaming",
      };

      setEntries((prev) => [...prev, userEntry, assistantEntry]);
      setState("streaming");
      setError(null);

      let completed = false;

      try {
        const events = agent.runStreamEvents(prompt, { deps });

        for await (const event of events) {
          if (controller.signal.aborted) break;

          switch (event.kind) {
            case "turn-start":
              setCurrentTurn(event.turn + 1);
              break;

            case "text-delta":
              setEntries((prev) => appendTextDelta(prev, assistantId, event.delta));
              break;

            case "tool-call-start":
              setEntries((prev) =>
                appendToolCall(prev, assistantId, {
                  kind: "tool-call",
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                  args: event.args,
                  status: "running",
                })
              );
              break;

            case "tool-call-result":
              setEntries((prev) =>
                updateToolCallResult(prev, assistantId, event.toolCallId, event.result)
              );
              break;

            case "usage-update":
              setUsage(event.usage);
              break;

            case "final-result":
              setEntries((prev) => markAssistantStatus(prev, assistantId, "complete"));
              setState("idle");
              completed = true;
              break;

            case "error": {
              const msg = formatError(event.error);
              setEntries((prev) => markAssistantStatus(prev, assistantId, "error", msg));
              setError(msg);
              setState("error");
              completed = true;
              break;
            }
          }
        }

        if (controller.signal.aborted) {
          setEntries((prev) => markAssistantStatus(prev, assistantId, "complete"));
          setState("idle");
        } else if (!completed) {
          setEntries((prev) => markAssistantStatus(prev, assistantId, "complete"));
          setState("idle");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const msg = formatError(err);
          setEntries((prev) => markAssistantStatus(prev, assistantId, "error", msg));
          setError(msg);
          setState("error");
        }
      }
    },
    [agent, state],
  );

  return { entries, send, abort, state, usage, currentTurn, error };
}

// ---------------------------------------------------------------------------
// Pure helper functions (immutable state updates)
// ---------------------------------------------------------------------------

export function appendTextDelta(
  entries: ConversationEntry[],
  assistantId: string,
  delta: string,
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "assistant" || entry.id !== assistantId) return entry;
    const items = entry.items;
    const lastItem = items[items.length - 1];
    if (lastItem?.kind === "text") {
      return {
        ...entry,
        items: [...items.slice(0, -1), { ...lastItem, content: lastItem.content + delta }],
      };
    }
    return { ...entry, items: [...items, { kind: "text", content: delta }] };
  });
}

export function appendToolCall(
  entries: ConversationEntry[],
  assistantId: string,
  toolCall: TurnItem,
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "assistant" || entry.id !== assistantId) return entry;
    return { ...entry, items: [...entry.items, toolCall] };
  });
}

export function updateToolCallResult(
  entries: ConversationEntry[],
  assistantId: string,
  toolCallId: string,
  result: unknown,
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "assistant" || entry.id !== assistantId) return entry;
    return {
      ...entry,
      items: entry.items.map((item) =>
        item.kind === "tool-call" && item.toolCallId === toolCallId
          ? { ...item, result, status: "done" as const }
          : item
      ),
    };
  });
}

export function markAssistantStatus(
  entries: ConversationEntry[],
  assistantId: string,
  status: "complete" | "error",
  errorMessage?: string,
): ConversationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "assistant" || entry.id !== assistantId) return entry;
    return { ...entry, status, ...(errorMessage !== undefined ? { errorMessage } : {}) };
  });
}

export function formatError(err: unknown): string {
  if (err instanceof Error) {
    if (
      err.name === "AI_NoOutputGeneratedError" ||
      err.message.includes("No output generated")
    ) {
      return "No response from model. Is ANTHROPIC_API_KEY set and valid?";
    }
    if (err.message.includes("401") || err.message.toLowerCase().includes("unauthorized")) {
      return "Authentication failed. Check your ANTHROPIC_API_KEY.";
    }
    if (err.message.includes("429") || err.message.toLowerCase().includes("rate limit")) {
      return "Rate limit hit. Wait a moment and try again.";
    }
    const prefix = err.name !== "Error" ? `[${err.name}] ` : "";
    const detail = err.cause instanceof Error ? `\nCaused by: ${err.cause.message}` : "";
    return `${prefix}${err.message}${detail}`;
  }
  return String(err);
}
