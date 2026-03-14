import type { LanguageModel, ModelMessage } from "ai";
import type { ZodTypeAny } from "zod";
import type {
	ResultValidator,
	RunContext,
	RunResult,
	StreamResult,
} from "./types.ts";
import type { ToolDefinition } from "./tool.ts";
import type { Toolset } from "./toolsets/toolset.ts";
import type { UsageLimits } from "./usage_limits.ts";
import type { HistoryProcessor } from "./history_processor.ts";
import type { ModelSettings } from "./model_settings.ts";
import type { InternalRunOpts } from "./execution/_run_utils.ts";
import { executeRun } from "./execution/run.ts";
import { executeStream } from "./execution/stream.ts";

export type SystemPromptFn<TDeps> = (
	ctx: RunContext<TDeps>,
) => string | Promise<string>;

/** Alias for the instructions field — same signature as systemPrompt. */
export type InstructionsFn<TDeps> = SystemPromptFn<TDeps>;

/**
 * Controls when the agent stops after receiving a `final_result` tool call.
 *
 * - `'early'` (default): Stop as soon as `final_result` is found, even if other
 *   tool calls were returned in the same response.
 * - `'exhaustive'`: Execute all other tool calls in the same response before
 *   returning the final result.
 */
export type EndStrategy = "early" | "exhaustive";

export interface AgentOptions<TDeps, TOutput> {
	/** Human-readable name for this agent. */
	name?: string;
	/** Vercel AI SDK model instance (e.g. anthropic("claude-..."), openai("gpt-...")) */
	model: LanguageModel;
	/** System prompt — a static string, a dynamic function, or a mixed array. */
	systemPrompt?:
		| string
		| SystemPromptFn<TDeps>
		| Array<string | SystemPromptFn<TDeps>>;
	/**
	 * Instructions injected each turn as part of the system prompt but NOT
	 * recorded in `result.messages` / `result.newMessages`. Same signature as
	 * `systemPrompt`. Equivalent to pydantic-ai's `instructions`.
	 */
	instructions?:
		| string
		| InstructionsFn<TDeps>
		| Array<string | InstructionsFn<TDeps>>;
	/** Tools available to the model. */
	tools?: ToolDefinition<TDeps>[];
	/** Composable toolsets (resolved per-turn). Combined with `tools`. */
	toolsets?: Toolset<TDeps>[];
	/** Zod schema for structured output. If omitted, output type is string. */
	outputSchema?: ZodTypeAny;
	/** Validators run after structured output is parsed. Throw to reject and retry. */
	resultValidators?: ResultValidator<TDeps, TOutput>[];
	/** Max retries for result validation failures. Default: 3 */
	maxRetries?: number;
	/** Max tool-call round trips before giving up. Default: 10 */
	maxTurns?: number;
	/** Cap cumulative token/request usage during a run. */
	usageLimits?: UsageLimits;
	/** Transform message history before each model call (trim, summarise, filter). */
	historyProcessors?: HistoryProcessor<TDeps>[];
	/**
	 * Model-specific settings (temperature, maxTokens, etc.) passed to
	 * `generateText` / `streamText` on every turn.
	 */
	modelSettings?: ModelSettings;
	/**
	 * When to stop after receiving a `final_result` tool call.
	 * `'early'` (default) stops immediately; `'exhaustive'` runs all other
	 * tool calls in the same response first.
	 */
	endStrategy?: EndStrategy;
	/**
	 * Maximum number of tool executions that may run concurrently within a
	 * single model turn. Defaults to unlimited.
	 */
	maxConcurrency?: number;
}

/** Options accepted by `agent.run()` and `agent.stream()`. */
export interface RunOptions<TDeps> {
	deps?: TDeps;
	messageHistory?: ModelMessage[];
	/** Per-run metadata accessible on `ctx.metadata` in tools and validators. */
	metadata?: Record<string, unknown>;
	/** Per-run usage limits (override the agent-level limits). */
	usageLimits?: UsageLimits;
	/** Per-run model settings (override the agent-level modelSettings). */
	modelSettings?: ModelSettings;
	/** Per-run end strategy (override the agent-level endStrategy). */
	endStrategy?: EndStrategy;
}

/** Options accepted by `agent.override()`. */
export interface AgentOverrideOptions<TDeps, TOutput> {
	model?: LanguageModel;
	systemPrompt?:
		| string
		| SystemPromptFn<TDeps>
		| Array<string | SystemPromptFn<TDeps>>;
	instructions?:
		| string
		| InstructionsFn<TDeps>
		| Array<string | InstructionsFn<TDeps>>;
	tools?: ToolDefinition<TDeps>[];
	toolsets?: Toolset<TDeps>[];
	resultValidators?: ResultValidator<TDeps, TOutput>[];
	maxRetries?: number;
	maxTurns?: number;
	usageLimits?: UsageLimits;
	historyProcessors?: HistoryProcessor<TDeps>[];
	modelSettings?: ModelSettings;
	endStrategy?: EndStrategy;
}

export class Agent<TDeps = undefined, TOutput = string> {
	readonly name: string | undefined;
	readonly model: LanguageModel;
	readonly outputSchema: ZodTypeAny | undefined;
	readonly maxRetries: number;
	readonly maxTurns: number;
	readonly usageLimits: UsageLimits | undefined;
	readonly modelSettings: ModelSettings | undefined;
	readonly endStrategy: EndStrategy;
	readonly maxConcurrency: number | undefined;

	private _systemPrompts: (string | SystemPromptFn<TDeps>)[];
	private _instructions: (string | InstructionsFn<TDeps>)[];
	private _tools: ToolDefinition<TDeps>[];
	private _toolsets: Toolset<TDeps>[];
	private _resultValidators: ResultValidator<TDeps, TOutput>[];
	private _historyProcessors: HistoryProcessor<TDeps>[];

	constructor(opts: AgentOptions<TDeps, TOutput>) {
		this.name = opts.name;
		this.model = opts.model;
		this.outputSchema = opts.outputSchema;
		this.maxRetries = opts.maxRetries ?? 3;
		this.maxTurns = opts.maxTurns ?? 10;
		this.usageLimits = opts.usageLimits;
		this.modelSettings = opts.modelSettings;
		this.endStrategy = opts.endStrategy ?? "early";
		this.maxConcurrency = opts.maxConcurrency;

		const sp = opts.systemPrompt;
		this._systemPrompts = sp
			? Array.isArray(sp)
				? [...sp]
				: [sp]
			: [];

		const ins = opts.instructions;
		this._instructions = ins
			? Array.isArray(ins)
				? [...ins]
				: [ins]
			: [];

		this._tools = opts.tools ? [...opts.tools] : [];
		this._toolsets = opts.toolsets ? [...opts.toolsets] : [];
		this._resultValidators = opts.resultValidators
			? [...opts.resultValidators]
			: [];
		this._historyProcessors = opts.historyProcessors
			? [...opts.historyProcessors]
			: [];
	}

	addTool(t: ToolDefinition<TDeps>): void {
		this._tools.push(t);
	}

	addToolset(ts: Toolset<TDeps>): void {
		this._toolsets.push(ts);
	}

	addSystemPrompt(prompt: string | SystemPromptFn<TDeps>): void {
		this._systemPrompts.push(prompt);
	}

	addInstruction(instruction: string | InstructionsFn<TDeps>): void {
		this._instructions.push(instruction);
	}

	addResultValidator(validator: ResultValidator<TDeps, TOutput>): void {
		this._resultValidators.push(validator);
	}

	addHistoryProcessor(processor: HistoryProcessor<TDeps>): void {
		this._historyProcessors.push(processor);
	}

	get systemPrompts(): ReadonlyArray<string | SystemPromptFn<TDeps>> {
		return this._systemPrompts;
	}

	get instructions(): ReadonlyArray<string | InstructionsFn<TDeps>> {
		return this._instructions;
	}

	get tools(): ReadonlyArray<ToolDefinition<TDeps>> {
		return this._tools;
	}

	get toolsets(): ReadonlyArray<Toolset<TDeps>> {
		return this._toolsets;
	}

	get resultValidators(): ReadonlyArray<ResultValidator<TDeps, TOutput>> {
		return this._resultValidators;
	}

	get historyProcessors(): ReadonlyArray<HistoryProcessor<TDeps>> {
		return this._historyProcessors;
	}

	run(
		prompt: string,
		opts?: RunOptions<TDeps>,
	): Promise<RunResult<TOutput>> {
		return executeRun<TDeps, TOutput>(this, prompt, {
			deps: opts?.deps as TDeps,
			messageHistory: opts?.messageHistory,
			metadata: opts?.metadata,
			usageLimits: opts?.usageLimits,
			modelSettings: opts?.modelSettings,
			endStrategy: opts?.endStrategy,
		});
	}

	stream(
		prompt: string,
		opts?: RunOptions<TDeps>,
	): StreamResult<TOutput> {
		return executeStream<TDeps, TOutput>(this, prompt, {
			deps: opts?.deps as TDeps,
			messageHistory: opts?.messageHistory,
			metadata: opts?.metadata,
			usageLimits: opts?.usageLimits,
			modelSettings: opts?.modelSettings,
			endStrategy: opts?.endStrategy,
		});
	}

	/**
	 * Returns a scoped runner that overrides specific agent settings for a
	 * single `run()` or `stream()` call. Does not mutate the original agent.
	 * Critical for test patterns — override runs bypass the
	 * `setAllowModelRequests(false)` guard.
	 *
	 * @example
	 * ```ts
	 * const result = await agent.override({ model: mockModel }).run(prompt);
	 * ```
	 */
	override(
		overrides: AgentOverrideOptions<TDeps, TOutput>,
	): { run: (prompt: string, opts?: RunOptions<TDeps>) => Promise<RunResult<TOutput>>; stream: (prompt: string, opts?: RunOptions<TDeps>) => StreamResult<TOutput> } {
		const normaliseSystemPrompt = (
			sp:
				| string
				| SystemPromptFn<TDeps>
				| Array<string | SystemPromptFn<TDeps>>
				| undefined,
		): Array<string | SystemPromptFn<TDeps>> | undefined => {
			if (sp === undefined) return undefined;
			return Array.isArray(sp) ? sp : [sp];
		};

		const buildOpts = (
			_prompt: string,
			runOpts?: RunOptions<TDeps>,
		): InternalRunOpts<TDeps, TOutput> => ({
			deps: runOpts?.deps as TDeps,
			messageHistory: runOpts?.messageHistory,
			metadata: runOpts?.metadata,
			usageLimits: runOpts?.usageLimits,
			modelSettings: runOpts?.modelSettings,
			endStrategy: runOpts?.endStrategy,
			_bypassModelRequestsCheck: true,
			_override: {
				model: overrides.model,
				systemPrompts: normaliseSystemPrompt(overrides.systemPrompt),
				instructions: normaliseSystemPrompt(overrides.instructions),
				tools: overrides.tools,
				toolsets: overrides.toolsets,
				resultValidators: overrides.resultValidators,
				maxRetries: overrides.maxRetries,
				maxTurns: overrides.maxTurns,
				usageLimits: overrides.usageLimits,
				historyProcessors: overrides.historyProcessors,
				modelSettings: overrides.modelSettings,
				endStrategy: overrides.endStrategy,
			},
		});

		// Capture `this` for the returned object
		const self = this;
		return {
			run(prompt: string, opts?: RunOptions<TDeps>) {
				return executeRun<TDeps, TOutput>(self, prompt, buildOpts(prompt, opts));
			},
			stream(prompt: string, opts?: RunOptions<TDeps>) {
				return executeStream<TDeps, TOutput>(
					self,
					prompt,
					buildOpts(prompt, opts),
				);
			},
		};
	}
}
