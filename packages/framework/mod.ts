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

export { MaxTurnsError, MaxRetriesError } from "./errors.ts";

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

// Toolsets
export type { Toolset } from "./toolsets/toolset.ts";
export { FunctionToolset } from "./toolsets/function_toolset.ts";
export { CombinedToolset } from "./toolsets/combined_toolset.ts";
export { FilteredToolset } from "./toolsets/filtered_toolset.ts";
export {
	PrefixedToolset,
	RenamedToolset,
} from "./toolsets/prefixed_toolset.ts";

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
	binaryContentToBase64,
	binaryContentToToolResult,
	uploadedFileToToolResult,
} from "./binary_content.ts";
