import type { Usage } from "@vibes/framework";

export type TurnItem =
  | { kind: "text"; content: string }
  | {
    kind: "tool-call";
    toolName: string;
    toolCallId: string;
    args: Record<string, unknown>;
    result?: unknown;
    status: "running" | "done";
  };

export type ConversationEntry =
  | { kind: "user"; id: string; content: string }
  | {
    kind: "assistant";
    id: string;
    items: TurnItem[];
    status: "streaming" | "complete" | "error";
    errorMessage?: string;
  };

export type AgentSessionState = "idle" | "streaming" | "error";

export interface TuiConfig {
  workflowId: string;
  contextDir: string;
}

export type { Usage };
