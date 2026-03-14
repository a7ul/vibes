import type { LanguageModel, ModelMessage } from "ai";
import { generateText } from "ai";
import type { RunContext } from "../types/context.ts";

/**
 * A function that transforms the message history before each model call.
 * Processors are applied in order. They receive the accumulated messages
 * and the current run context, and return a (possibly shorter/modified) list
 * of messages to actually send to the model.
 *
 * Processors do NOT mutate the stored history — they only affect what's
 * sent to the model on that turn.
 */
export type HistoryProcessor<TDeps = undefined> = (
  messages: ModelMessage[],
  ctx: RunContext<TDeps>,
) => ModelMessage[] | Promise<ModelMessage[]>;

/**
 * Keeps only the last `n` messages in the history sent to the model.
 * Useful for long-running conversations where old context is not needed.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   model,
 *   historyProcessors: [trimHistoryProcessor(20)],
 * });
 * ```
 */
export function trimHistoryProcessor(maxMessages: number): HistoryProcessor {
  return (messages) => {
    if (messages.length <= maxMessages) return messages;
    return messages.slice(-maxMessages);
  };
}

/**
 * Default token estimator: approximates tokens as ceil(JSON length / 4).
 */
function defaultTokenCounter(msg: ModelMessage): number {
  return Math.ceil(JSON.stringify(msg).length / 4);
}

/**
 * Keeps the history under `maxTokens` by trimming oldest non-system messages first.
 * System messages are always preserved. The most recent messages are kept intact.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   model,
 *   historyProcessors: [tokenTrimHistoryProcessor(4000)],
 * });
 * ```
 */
export function tokenTrimHistoryProcessor(
  maxTokens: number,
  tokenCounter: (msg: ModelMessage) => number = defaultTokenCounter,
): HistoryProcessor {
  return (messages) => {
    const totalTokens = messages.reduce(
      (sum, msg) => sum + tokenCounter(msg),
      0,
    );
    if (totalTokens <= maxTokens) return messages;

    // Separate system messages (always keep) from the rest
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const systemTokens = systemMessages.reduce(
      (sum, msg) => sum + tokenCounter(msg),
      0,
    );
    const budget = maxTokens - systemTokens;

    // Walk from newest to oldest non-system messages, keeping until budget exhausted
    const kept: ModelMessage[] = [];
    let usedTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msg = nonSystemMessages[i];
      const cost = tokenCounter(msg);
      if (usedTokens + cost > budget) break;
      kept.unshift(msg);
      usedTokens += cost;
    }

    return [...systemMessages, ...kept];
  };
}

const DEFAULT_MAX_MESSAGES = 20;
const DEFAULT_SUMMARIZE_PROMPT =
  "Please summarize the following conversation history concisely, preserving the key information, decisions, and context that would be needed to continue the conversation:";

/**
 * When history exceeds `maxMessages`, calls the given model to summarize the
 * older portion of the conversation. The summary is injected as a single user
 * message, and only the most recent `floor(maxMessages / 2)` messages are kept.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   model,
 *   historyProcessors: [summarizeHistoryProcessor(model, { maxMessages: 30 })],
 * });
 * ```
 */
export function summarizeHistoryProcessor(
  model: LanguageModel,
  options?: {
    maxMessages?: number;
    summarizePrompt?: string;
  },
): HistoryProcessor {
  const maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const summarizePrompt = options?.summarizePrompt ?? DEFAULT_SUMMARIZE_PROMPT;
  const keepRecent = Math.floor(maxMessages / 2);

  return async (messages) => {
    // Filter out system messages — we summarize only user/assistant/tool turns
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    if (nonSystemMessages.length <= maxMessages) return messages;

    const toSummarize = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - keepRecent,
    );
    const toKeep = nonSystemMessages.slice(
      nonSystemMessages.length - keepRecent,
    );

    const historyText = toSummarize
      .map((m) => `[${m.role}]: ${extractTextContent(m)}`)
      .join("\n");

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: `${summarizePrompt}\n\n${historyText}`,
        },
      ],
    });

    const summaryMessage: ModelMessage = {
      role: "user",
      content: `[Conversation Summary]: ${result.text}`,
    };

    return [...systemMessages, summaryMessage, ...toKeep];
  };
}

/**
 * A privacy rule that applies a regex replacement to message text content.
 */
export type RegexPrivacyRule = {
  pattern: RegExp;
  replacement?: string;
};

/**
 * A privacy rule that removes or redacts a specific field from a message
 * matching the given role, referenced by a dot-separated path.
 */
export type FieldPrivacyRule = {
  messageType: "user" | "assistant" | "tool";
  fieldPath: string;
};

/**
 * A union of the supported privacy rule types.
 */
export type PrivacyRule = RegexPrivacyRule | FieldPrivacyRule;

function isRegexRule(rule: PrivacyRule): rule is RegexPrivacyRule {
  return "pattern" in rule;
}

function isFieldRule(rule: PrivacyRule): rule is FieldPrivacyRule {
  return "messageType" in rule && "fieldPath" in rule;
}

/**
 * Recursively apply regex replacements to any string values in a value tree.
 */
function applyRegexToValue(
  value: unknown,
  pattern: RegExp,
  replacement: string,
): unknown {
  if (typeof value === "string") {
    return value.replace(pattern, replacement);
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyRegexToValue(item, pattern, replacement));
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = applyRegexToValue(v, pattern, replacement);
    }
    return result;
  }
  return value;
}

/**
 * Apply regex rules to a message's text content parts.
 */
function applyRegexRuleToMessage(
  msg: ModelMessage,
  pattern: RegExp,
  replacement: string,
): ModelMessage {
  const content = applyRegexToValue(msg.content, pattern, replacement);
  return { ...msg, content } as ModelMessage;
}

/**
 * Delete a value at a dot-separated path in a nested object/array,
 * returning a new object (immutable).
 */
function deleteAtPath(
  value: unknown,
  pathParts: string[],
): unknown {
  if (pathParts.length === 0) return value;

  const [head, ...tail] = pathParts;

  if (Array.isArray(value)) {
    const index = parseInt(head, 10);
    if (isNaN(index) || index < 0 || index >= value.length) return value;
    if (tail.length === 0) {
      return [...value.slice(0, index), ...value.slice(index + 1)];
    }
    return value.map((item, i) =>
      i === index ? deleteAtPath(item, tail) : item
    );
  }

  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (!(head in obj)) return value;
    if (tail.length === 0) {
      const { [head]: _removed, ...rest } = obj;
      return rest;
    }
    return { ...obj, [head]: deleteAtPath(obj[head], tail) };
  }

  return value;
}

/**
 * Apply a field rule to a message: delete the field at the given path.
 */
function applyFieldRuleToMessage(
  msg: ModelMessage,
  rule: FieldPrivacyRule,
): ModelMessage {
  if (msg.role !== rule.messageType) return msg;
  const pathParts = rule.fieldPath.split(".");
  const newContent = deleteAtPath(msg.content, pathParts);
  // Cast through unknown to rebuild the discriminated union.
  // We've verified role matches above, so the content shape is correct.
  return { ...msg, content: newContent } as unknown as ModelMessage;
}

/**
 * Filters message history by applying privacy rules before each model call.
 * Regex rules scan all text content; field rules remove specific fields from
 * messages of the specified role.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   model,
 *   historyProcessors: [
 *     privacyFilterProcessor([
 *       { pattern: /\d{4}-\d{4}-\d{4}-\d{4}/, replacement: "[CARD]" },
 *     ]),
 *   ],
 * });
 * ```
 */
export function privacyFilterProcessor(rules: PrivacyRule[]): HistoryProcessor {
  return (messages) => {
    return messages.map((msg) => {
      let result = msg;
      for (const rule of rules) {
        if (isRegexRule(rule)) {
          const replacement = rule.replacement ?? "[REDACTED]";
          result = applyRegexRuleToMessage(result, rule.pattern, replacement);
        } else if (isFieldRule(rule)) {
          result = applyFieldRuleToMessage(result, rule);
        }
      }
      return result;
    });
  };
}

/**
 * Extract a plain-text representation of a message's content for summarization.
 * @internal
 */
function extractTextContent(msg: ModelMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (!Array.isArray(msg.content)) return JSON.stringify(msg.content);

  return msg.content
    .map((part) => {
      if (typeof part !== "object" || part === null) return String(part);
      const p = part as Record<string, unknown>;
      if (p["type"] === "text" && typeof p["text"] === "string") {
        return p["text"];
      }
      if (p["type"] === "tool-result") {
        return `[tool-result: ${JSON.stringify(p["result"])}]`;
      }
      if (p["type"] === "tool-call") {
        return `[tool-call: ${p["toolName"]}(${JSON.stringify(p["input"])})]`;
      }
      return JSON.stringify(part);
    })
    .join(" ");
}

/**
 * Applies a chain of history processors to the given message list.
 * @internal
 */
export async function applyHistoryProcessors<TDeps>(
  processors: ReadonlyArray<HistoryProcessor<TDeps>>,
  messages: ModelMessage[],
  ctx: RunContext<TDeps>,
): Promise<ModelMessage[]> {
  let result = messages;
  for (const processor of processors) {
    result = await processor(result, ctx);
  }
  return result;
}
