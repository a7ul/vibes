export { Agent } from "./agent.ts";
export type {
  AgentOptions,
  AgentOverrideOptions,
  EndStrategy,
  InstructionsFn,
  RunOptions,
  SystemPromptFn,
} from "./agent.ts";

export type { OutputMode } from "./types/output_mode.ts";

export type { ModelSettings } from "./types/model_settings.ts";

export { fromSchema, outputTool, plainTool, tool } from "./tool.ts";
export type { ToolDefinition, ToolExecuteReturn } from "./tool.ts";

export type {
  ResultValidator,
  RunContext,
  RunResult,
  StreamResult,
  Usage,
} from "./types.ts";
export { createUsage } from "./types.ts";

export type { ModelMessage } from "ai";

export {
  ApprovalRequiredError,
  MaxRetriesError,
  MaxTurnsError,
} from "./errors.ts";

export type { AgentStreamEvent } from "./types/events.ts";

export type { UsageLimits } from "./usage_limits.ts";

export type {
  FieldPrivacyRule,
  HistoryProcessor,
  PrivacyRule,
  RegexPrivacyRule,
} from "./history_processor.ts";
export {
  privacyFilterProcessor,
  summarizeHistoryProcessor,
  tokenTrimHistoryProcessor,
  trimHistoryProcessor,
} from "./history_processor.ts";

export {
  deserializeMessages,
  serializeMessages,
} from "./message_serialization.ts";

export {
  captureRunMessages,
  createTestModel,
  FunctionModel,
  getAllowModelRequests,
  setAllowModelRequests,
  TestModel,
} from "./testing.ts";
export type {
  DoGenerateResult,
  ModelFunction,
  ModelFunctionParams,
  TestModelOptions,
} from "./testing.ts";

// Deferred tools (human-in-the-loop)
export { DeferredToolRequests } from "./deferred.ts";
export type {
  DeferredToolRequest,
  DeferredToolResult,
  DeferredToolResults,
} from "./deferred.ts";

// Toolsets
export type { Toolset } from "./toolsets/toolset.ts";
export { FunctionToolset } from "./toolsets/function_toolset.ts";
export { CombinedToolset } from "./toolsets/combined_toolset.ts";
export { FilteredToolset } from "./toolsets/filtered_toolset.ts";
export {
  PrefixedToolset,
  RenamedToolset,
} from "./toolsets/prefixed_toolset.ts";
export { PreparedToolset } from "./toolsets/prepared_toolset.ts";
export type { PrepareFunction } from "./toolsets/prepared_toolset.ts";
export { WrapperToolset } from "./toolsets/wrapper_toolset.ts";
export type { ToolCallNext } from "./toolsets/wrapper_toolset.ts";
export { ApprovalRequiredToolset } from "./toolsets/approval_required_toolset.ts";
export { ExternalToolset } from "./toolsets/external_toolset.ts";
export type { ExternalToolDefinition } from "./toolsets/external_toolset.ts";

// Binary / multi-modal content
export type {
  BinaryContent,
  BinaryImage,
  MultiModalContent,
  UploadedFile,
} from "./binary_content.ts";
export {
  binaryContentSchema,
  binaryContentToToolResult,
  isAudioContent,
  isBinaryContent,
  isDocumentContent,
  isImageContent,
  isMultiModalContent,
  isUploadedFile,
  isVideoContent,
  uploadedFileSchema,
  uploadedFileToToolResult,
} from "./binary_content.ts";

// Multi-modal user message helpers
export type {
  AudioPart,
  FilePart,
  ImagePart,
  TextPart,
  UserMessagePart,
} from "./content.ts";
export { audioMessage, fileMessage, imageMessage } from "./content.ts";

// Graph FSM (multi-agent typed state machine)
export type {
  GraphOptions,
  GraphRunOptions,
  GraphSnapshot,
  GraphStep,
  NodeId,
  NodeResult,
  StatePersistence,
} from "./graph/mod.ts";
export { next, output } from "./graph/mod.ts";
export { BaseNode } from "./graph/mod.ts";
export { Graph, GraphRun } from "./graph/mod.ts";
export { FileStatePersistence, MemoryStatePersistence } from "./graph/mod.ts";
export { MaxGraphIterationsError, UnknownNodeError } from "./graph/mod.ts";
export { toMermaid } from "./graph/mod.ts";

// AG-UI protocol adapter
export { AGUIAdapter } from "./ag_ui/adapter.ts";
export type {
  AGUIAdapterOptions,
  AGUIMessage,
  AGUIRunInput,
} from "./ag_ui/adapter.ts";
export type { AGUIEvent } from "./ag_ui/types.ts";

// OpenTelemetry instrumentation
export type {
  InstrumentationOptions,
  TelemetrySettings,
} from "./otel/otel_types.ts";
export {
  createTelemetrySettings,
  instrumentAgent,
} from "./otel/instrumentation.ts";
export {
  recordRunAttributes,
  recordUsageAttributes,
  withAgentSpan,
} from "./otel/spans.ts";

// Temporal durable execution integration
export { TemporalAgent } from "./temporal/temporal_agent.ts";
export { MockTemporalAgent } from "./temporal/mock_temporal.ts";
export {
  deserializeRunState,
  roundTripMessages,
  serializeRunState,
} from "./temporal/serialization.ts";
export type {
  ActivityHistoryEntry,
  ModelTurnParams,
  ModelTurnResult,
  SerializableMessage,
  SerializableRunOptions,
  TemporalActivityOptions,
  TemporalAgentOptions,
  ToolCallParams,
  ToolCallResult,
} from "./temporal/types.ts";

// MCP (Model Context Protocol) integration
export type {
  ElicitationCallback,
  ElicitationRequest,
  MCPCallResult,
  MCPClient,
  MCPContentItem,
  MCPHttpConfig,
  MCPImageContent,
  MCPServerConfig,
  MCPStdioConfig,
  MCPTextContent,
  MCPTool,
  MCPToolsetOptions,
} from "./mcp/mod.ts";
export {
  createClientsFromConfig,
  createManagerFromConfig,
  loadMCPConfig,
  MCPHttpClient,
  MCPManager,
  MCPStdioClient,
  MCPToolset,
} from "./mcp/mod.ts";
