export { Agent } from "./lib/agent.ts";
export type {
	AgentOptions,
	AgentOverrideOptions,
	EndStrategy,
	InstructionsFn,
	RunOptions,
	SystemPromptFn,
} from "./lib/agent.ts";

export type { OutputMode } from "./lib/types/output_mode.ts";

export type { ModelSettings } from "./lib/types/model_settings.ts";

export { fromSchema, outputTool, plainTool, tool } from "./lib/tool.ts";
export type { ToolDefinition, ToolExecuteReturn } from "./lib/tool.ts";

export type {
	ResultValidator,
	RunContext,
	RunResult,
	StreamResult,
	Usage,
} from "./lib/types/mod.ts";
export { createUsage } from "./lib/types/mod.ts";

export type { ModelMessage } from "ai";

export {
	ApprovalRequiredError,
	MaxRetriesError,
	MaxTurnsError,
} from "./lib/types/errors.ts";

export type { AgentStreamEvent } from "./lib/types/events.ts";

export type { UsageLimits } from "./lib/types/usage_limits.ts";

export type {
	FieldPrivacyRule,
	HistoryProcessor,
	PrivacyRule,
	RegexPrivacyRule,
} from "./lib/history/processor.ts";
export {
	privacyFilterProcessor,
	summarizeHistoryProcessor,
	tokenTrimHistoryProcessor,
	trimHistoryProcessor,
} from "./lib/history/processor.ts";

export {
	deserializeMessages,
	serializeMessages,
} from "./lib/history/serialization.ts";

export {
	captureRunMessages,
	createTestModel,
	FunctionModel,
	getAllowModelRequests,
	setAllowModelRequests,
	TestModel,
} from "./lib/testing/mod.ts";
export type {
	DoGenerateResult,
	ModelFunction,
	ModelFunctionParams,
	TestModelOptions,
} from "./lib/testing/mod.ts";

// Deferred tools (human-in-the-loop)
export { DeferredToolRequests } from "./lib/execution/deferred.ts";
export type {
	DeferredToolRequest,
	DeferredToolResult,
	DeferredToolResults,
} from "./lib/execution/deferred.ts";

// Toolsets
export type { Toolset } from "./lib/toolsets/toolset.ts";
export { FunctionToolset } from "./lib/toolsets/function_toolset.ts";
export { CombinedToolset } from "./lib/toolsets/combined_toolset.ts";
export { FilteredToolset } from "./lib/toolsets/filtered_toolset.ts";
export {
	PrefixedToolset,
	RenamedToolset,
} from "./lib/toolsets/prefixed_toolset.ts";
export { PreparedToolset } from "./lib/toolsets/prepared_toolset.ts";
export type { PrepareFunction } from "./lib/toolsets/prepared_toolset.ts";
export { WrapperToolset } from "./lib/toolsets/wrapper_toolset.ts";
export type { ToolCallNext } from "./lib/toolsets/wrapper_toolset.ts";
export { ApprovalRequiredToolset } from "./lib/toolsets/approval_required_toolset.ts";
export { ExternalToolset } from "./lib/toolsets/external_toolset.ts";
export type { ExternalToolDefinition } from "./lib/toolsets/external_toolset.ts";

// Binary / multi-modal content
export type {
	BinaryContent,
	BinaryImage,
	BinaryImageOutputSentinel,
	MultiModalContent,
	UploadedFile,
} from "./lib/multimodal/binary_content.ts";
export {
	BINARY_IMAGE_OUTPUT,
	binaryContentSchema,
	binaryContentToToolResult,
	extractBinaryImageFromToolOutput,
	isAudioContent,
	isBinaryContent,
	isBinaryImageOutput,
	isDocumentContent,
	isImageContent,
	isMultiModalContent,
	isUploadedFile,
	isVideoContent,
	uploadedFileSchema,
	uploadedFileToToolResult,
} from "./lib/multimodal/binary_content.ts";

// Multi-modal user message helpers
export type {
	AudioPart,
	FilePart,
	ImagePart,
	TextPart,
	UserMessagePart,
} from "./lib/multimodal/content.ts";
export {
	audioMessage,
	fileMessage,
	imageMessage,
} from "./lib/multimodal/content.ts";

// Graph FSM (multi-agent typed state machine)
export type {
	GraphOptions,
	GraphRunOptions,
	GraphSnapshot,
	GraphStep,
	NodeId,
	NodeResult,
	StatePersistence,
} from "./lib/graph/mod.ts";
export { next, output } from "./lib/graph/mod.ts";
export { BaseNode } from "./lib/graph/mod.ts";
export { Graph, GraphRun } from "./lib/graph/mod.ts";
export {
	FileStatePersistence,
	MemoryStatePersistence,
} from "./lib/graph/mod.ts";
export { MaxGraphIterationsError, UnknownNodeError } from "./lib/graph/mod.ts";
export { toMermaid } from "./lib/graph/mod.ts";

// A2A (Agent-to-Agent) protocol adapter
export { A2AAdapter } from "./lib/a2a/adapter.ts";
export type { A2AAdapterOptions } from "./lib/a2a/adapter.ts";
export { MemoryTaskStore } from "./lib/a2a/task_store.ts";
export type { TaskStore } from "./lib/a2a/task_store.ts";
export type {
  A2AArtifact,
  A2AMessage,
  A2APart,
  A2ATask,
  A2ATaskState,
  A2ATaskStatus,
  AgentCard,
} from "./lib/a2a/types.ts";

// AG-UI protocol adapter
export { AGUIAdapter } from "./lib/ag_ui/adapter.ts";
export type {
	AGUIAdapterOptions,
	AGUIMessage,
	AGUIRunInput,
} from "./lib/ag_ui/adapter.ts";
export type { AGUIEvent } from "./lib/ag_ui/types.ts";

// OpenTelemetry instrumentation
export type {
	InstrumentationOptions,
	TelemetrySettings,
} from "./lib/otel/otel_types.ts";
export {
	createTelemetrySettings,
	instrumentAgent,
} from "./lib/otel/instrumentation.ts";
export {
	recordRunAttributes,
	recordUsageAttributes,
	withAgentSpan,
} from "./lib/otel/spans.ts";

// Temporal durable execution integration
export { TemporalAgent } from "./lib/temporal/temporal_agent.ts";
export { MockTemporalAgent } from "./lib/temporal/mock_temporal.ts";
export {
	deserializeRunState,
	roundTripMessages,
	serializeRunState,
} from "./lib/temporal/serialization.ts";
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
} from "./lib/temporal/types.ts";

// Evaluation framework (Pydantic Evals port)
export type {
  Case,
  CaseResult,
  EvalScore,
  EvaluationReason,
  Evaluator,
  ExperimentResult,
  ReportEvaluator,
} from "./lib/evals/types.ts";
export { EvalError } from "./lib/evals/types.ts";
export { EvaluatorContext } from "./lib/evals/context.ts";
export type { EvaluatorContextOptions } from "./lib/evals/context.ts";
export { SpanNode, SpanTree } from "./lib/evals/span_tree.ts";
export type { SpanData } from "./lib/evals/span_tree.ts";
export { Dataset } from "./lib/evals/dataset.ts";
export type { DatasetOptions, EvaluateOptions } from "./lib/evals/dataset.ts";
export { CaseLifecycle } from "./lib/evals/lifecycle.ts";
export {
  contains,
  custom,
  equals,
  equalsExpected,
  hasMatchingSpan,
  isInstance,
  isValidSchema,
  maxDuration,
} from "./lib/evals/builtin_evaluators.ts";
export {
  confusionMatrix,
  kolmogorovSmirnov,
  precisionRecall,
  rocAuc,
} from "./lib/evals/report_evaluators.ts";
export {
  judgeInputOutput,
  judgeInputOutputExpected,
  judgeOutput,
  judgeOutputExpected,
  llmJudge,
  setDefaultJudgeModel,
} from "./lib/evals/llm_judge.ts";
export type { LLMJudgeOptions } from "./lib/evals/llm_judge.ts";
export { generateDataset } from "./lib/evals/generation.ts";
export type { GenerateDatasetOptions } from "./lib/evals/generation.ts";
export { runExperiment } from "./lib/evals/experiment.ts";
export type { RunExperimentOptions } from "./lib/evals/experiment.ts";
export { formatReport, toJSON } from "./lib/evals/report.ts";

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
} from "./lib/mcp/mod.ts";
export {
	createClientsFromConfig,
	createManagerFromConfig,
	loadMCPConfig,
	MCPHttpClient,
	MCPManager,
	MCPStdioClient,
	MCPToolset,
} from "./lib/mcp/mod.ts";

// Community toolsets
export {
	DirectorySkillLoader,
	InMemoryStore,
	MemoryTodoStore,
	MemoryToolset,
	SkillsToolset,
	TodoToolset,
} from "./community/mod.ts";
export type {
	Memory,
	MemoryStore,
	Skill,
	SkillLoader,
	SkillMeta,
	Todo,
	TodoStatus,
	TodoStore,
} from "./community/mod.ts";
