/**
 * A2A (Agent-to-Agent) protocol types.
 * Based on the A2A specification: https://google.github.io/A2A/
 */

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export interface A2ATextPart {
  kind: "text";
  text: string;
  metadata?: Record<string, unknown>;
}

export interface A2AFileContent {
  /** Base64-encoded file bytes. Mutually exclusive with uri. */
  bytes?: string;
  /** File URI. Mutually exclusive with bytes. */
  uri?: string;
  mimeType?: string;
  name?: string;
}

export interface A2AFilePart {
  kind: "file";
  file: A2AFileContent;
  metadata?: Record<string, unknown>;
}

export interface A2ADataPart {
  kind: "data";
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type A2APart = A2ATextPart | A2AFilePart | A2ADataPart;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface A2AMessage {
  kind: "message";
  messageId: string;
  role: "user" | "agent";
  parts: A2APart[];
  taskId?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
  index?: number;
  lastChunk?: boolean;
  append?: boolean;
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export type A2ATaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed";

export interface A2ATask {
  kind: "task";
  id: string;
  contextId: string;
  status: A2ATaskStatus;
  history?: A2AMessage[];
  artifacts?: A2AArtifact[];
  metadata?: Record<string, unknown>;
}

export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Agent Card
// ---------------------------------------------------------------------------

export interface A2AAgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

export interface A2AAgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface A2AAgentProvider {
  organization: string;
  url?: string;
}

export interface AgentCard {
  name: string;
  description?: string;
  url: string;
  version: string;
  capabilities: A2AAgentCapabilities;
  skills: A2AAgentSkill[];
  provider?: A2AAgentProvider;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  documentationUrl?: string;
  iconUrl?: string;
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcError;

// JSON-RPC error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
// A2A-specific error codes
export const TASK_NOT_FOUND = -32001;
export const TASK_CANCELED = -32002;
export const UNSUPPORTED_OPERATION = -32004;

// ---------------------------------------------------------------------------
// A2A Method params
// ---------------------------------------------------------------------------

export interface TaskSendParams {
  id: string;
  contextId?: string;
  message: A2AMessage;
  acceptedOutputModes?: string[];
  metadata?: Record<string, unknown>;
}

export interface TaskGetParams {
  id: string;
}

export interface TaskCancelParams {
  id: string;
}

// ---------------------------------------------------------------------------
// SSE event types for tasks/sendSubscribe
// ---------------------------------------------------------------------------

export interface A2ATaskStatusUpdateEvent {
  kind: "status-update";
  taskId: string;
  contextId: string;
  status: A2ATaskStatus;
  final?: boolean;
}

export interface A2ATaskArtifactUpdateEvent {
  kind: "artifact-update";
  taskId: string;
  contextId: string;
  artifact: A2AArtifact;
}

export type A2AStreamEvent =
  | A2ATaskStatusUpdateEvent
  | A2ATaskArtifactUpdateEvent;
