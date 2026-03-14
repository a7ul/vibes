export { Agent } from "./agent.ts";
export type {
	AgentOptions,
	AgentOverrideOptions,
	RunOptions,
	SystemPromptFn,
	InstructionsFn,
	EndStrategy,
} from "./agent.ts";

export type { OutputMode } from "./output_mode.ts";

export type { ModelSettings } from "./model_settings.ts";
export { Semaphore } from "./concurrency.ts";

export { tool, plainTool, fromSchema, outputTool, toAISDKTools } from "./tool.ts";
export type { ToolDefinition, ToolExecuteReturn } from "./tool.ts";

export type {
	RunContext,
	RunResult,
	StreamResult,
	ResultValidator,
	Usage,
} from "./types.ts";
export { createUsage } from "./types.ts";

export type { ModelMessage } from "ai";

export { MaxTurnsError, MaxRetriesError, ApprovalRequiredError } from "./errors.ts";

export type { AgentStreamEvent } from "./events.ts";

export type { UsageLimits } from "./usage_limits.ts";

export type {
	HistoryProcessor,
	PrivacyRule,
	RegexPrivacyRule,
	FieldPrivacyRule,
} from "./history_processor.ts";
export {
	trimHistoryProcessor,
	tokenTrimHistoryProcessor,
	summarizeHistoryProcessor,
	privacyFilterProcessor,
} from "./history_processor.ts";

export {
	serializeMessages,
	deserializeMessages,
} from "./message_serialization.ts";

export {
	setAllowModelRequests,
	getAllowModelRequests,
	captureRunMessages,
	TestModel,
	createTestModel,
	FunctionModel,
} from "./testing.ts";
export type {
	TestModelOptions,
	ModelFunction,
	ModelFunctionParams,
	DoGenerateResult,
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
	UploadedFile,
	MultiModalContent,
} from "./binary_content.ts";
export {
	isBinaryContent,
	isUploadedFile,
	isMultiModalContent,
	isImageContent,
	isAudioContent,
	isVideoContent,
	isDocumentContent,
	binaryContentToBase64,
	toDataUrl,
	binaryContentToToolResult,
	uploadedFileToToolResult,
	binaryContentSchema,
	uploadedFileSchema,
} from "./binary_content.ts";

// Multi-modal user message helpers
export type {
	TextPart,
	ImagePart,
	AudioPart,
	FilePart,
	UserMessagePart,
} from "./content.ts";
export {
	imageMessage,
	audioMessage,
	fileMessage,
} from "./content.ts";

// MCP (Model Context Protocol) integration
export type {
	MCPTool,
	MCPTextContent,
	MCPImageContent,
	MCPContentItem,
	MCPCallResult,
	MCPServerConfig,
	ElicitationRequest,
	ElicitationCallback,
	MCPClient,
	MCPStdioConfig,
	MCPHttpConfig,
	MCPToolsetOptions,
} from "./mcp/mod.ts";
export {
	MCPStdioClient,
	MCPHttpClient,
	MCPToolset,
	MCPManager,
	loadMCPConfig,
	createClientsFromConfig,
	createManagerFromConfig,
} from "./mcp/mod.ts";
