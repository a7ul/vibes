import type { ModelMessage, LanguageModel } from "ai";
import type { ZodTypeAny } from "zod";
import type {
	ResultValidator,
	RunContext,
	RunResult,
	StreamResult,
} from "./types.ts";
import type { ToolDefinition } from "./tool.ts";
import { executeRun } from "./execution/run.ts";
import { executeStream } from "./execution/stream.ts";

export type SystemPromptFn<TDeps> = (
	ctx: RunContext<TDeps>,
) => string | Promise<string>;

export interface AgentOptions<TDeps, TOutput> {
	/** Human-readable name for this agent. */
	name?: string;
	/** Vercel AI SDK model instance (e.g. anthropic("claude-..."), openai("gpt-...")) */
	model: LanguageModel;
	/** System prompt — a static string or a dynamic function. */
	systemPrompt?: string | SystemPromptFn<TDeps>;
	/** Tools available to the model. */
	tools?: ToolDefinition<TDeps>[];
	/** Zod schema for structured output. If omitted, output type is string. */
	outputSchema?: ZodTypeAny;
	/** Validators run after structured output is parsed. Throw to reject and retry. */
	resultValidators?: ResultValidator<TDeps, TOutput>[];
	/** Max retries for result validation failures. Default: 3 */
	maxRetries?: number;
	/** Max tool-call round trips before giving up. Default: 10 */
	maxTurns?: number;
}

export class Agent<TDeps = undefined, TOutput = string> {
	readonly name: string | undefined;
	readonly model: LanguageModel;
	readonly outputSchema: ZodTypeAny | undefined;
	readonly maxRetries: number;
	readonly maxTurns: number;

	private _systemPrompts: (string | SystemPromptFn<TDeps>)[];
	private _tools: ToolDefinition<TDeps>[];
	private _resultValidators: ResultValidator<TDeps, TOutput>[];

	constructor(opts: AgentOptions<TDeps, TOutput>) {
		this.name = opts.name;
		this.model = opts.model;
		this.outputSchema = opts.outputSchema;
		this.maxRetries = opts.maxRetries ?? 3;
		this.maxTurns = opts.maxTurns ?? 10;
		this._systemPrompts = opts.systemPrompt ? [opts.systemPrompt] : [];
		this._tools = opts.tools ? [...opts.tools] : [];
		this._resultValidators = opts.resultValidators
			? [...opts.resultValidators]
			: [];
	}

	addTool(t: ToolDefinition<TDeps>): void {
		this._tools.push(t);
	}

	addSystemPrompt(prompt: string | SystemPromptFn<TDeps>): void {
		this._systemPrompts.push(prompt);
	}

	addResultValidator(validator: ResultValidator<TDeps, TOutput>): void {
		this._resultValidators.push(validator);
	}

	get systemPrompts(): ReadonlyArray<string | SystemPromptFn<TDeps>> {
		return this._systemPrompts;
	}

	get tools(): ReadonlyArray<ToolDefinition<TDeps>> {
		return this._tools;
	}

	get resultValidators(): ReadonlyArray<ResultValidator<TDeps, TOutput>> {
		return this._resultValidators;
	}

	run(
		prompt: string,
		opts?: { deps?: TDeps; messageHistory?: ModelMessage[] },
	): Promise<RunResult<TOutput>> {
		return executeRun<TDeps, TOutput>(this, prompt, {
			deps: opts?.deps as TDeps,
			messageHistory: opts?.messageHistory,
		});
	}

	stream(
		prompt: string,
		opts?: { deps?: TDeps; messageHistory?: ModelMessage[] },
	): StreamResult<TOutput> {
		return executeStream<TDeps, TOutput>(this, prompt, {
			deps: opts?.deps as TDeps,
			messageHistory: opts?.messageHistory,
		});
	}
}
