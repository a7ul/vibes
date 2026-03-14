import type { Usage } from "@vibes/framework";

export type MessageRole = "user" | "assistant";

export interface TuiMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export type AgentState = "idle" | "streaming" | "complete" | "error";

export interface TuiConfig {
  workflowId: string;
  contextDir: string;
}

export interface AgentStateSnapshot {
  state: AgentState;
  streamedText: string;
  usage: Usage | null;
  error: string | null;
}
