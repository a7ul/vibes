import type { ModelMessage } from "ai";
import type { Agent } from "../agent.ts";
import type { AGUIEvent } from "./types.ts";

// ---------------------------------------------------------------------------
// AG-UI run input
// ---------------------------------------------------------------------------

export interface AGUIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AGUIRunInput {
  /** Client-supplied thread identifier for multi-turn continuations. */
  threadId: string;
  /** Optional run identifier; auto-generated when omitted. */
  runId?: string;
  /** Conversation history including the latest user message. */
  messages: AGUIMessage[];
  /** Optional initial agent state to include in the STATE_SNAPSHOT event. */
  state?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

/** Serialise an AGUIEvent to an SSE data line followed by a blank line. */
function formatSSE(event: AGUIEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Encode a string to a Uint8Array using UTF-8. */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// ---------------------------------------------------------------------------
// Message conversion
// ---------------------------------------------------------------------------

/**
 * Convert AG-UI messages to the `ModelMessage[]` format consumed by the
 * framework's `messageHistory` option. The last user message is extracted as
 * the prompt and is NOT included in the history array.
 */
function convertMessages(messages: AGUIMessage[]): {
  prompt: string;
  messageHistory: ModelMessage[];
} {
  if (messages.length === 0) {
    return { prompt: "", messageHistory: [] };
  }

  // Find the last user message to use as the prompt
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }

  const prompt = lastUserIndex >= 0 ? messages[lastUserIndex].content : "";

  // Build history from all messages except the last user message
  const history: ModelMessage[] = messages
    .filter((_, index) => index !== lastUserIndex)
    .map((msg): ModelMessage => {
      if (msg.role === "user") {
        return { role: "user", content: msg.content };
      }
      return {
        role: "assistant",
        content: [{ type: "text", text: msg.content }],
      };
    });

  return { prompt, messageHistory: history };
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

// ---------------------------------------------------------------------------
// AGUIAdapter
// ---------------------------------------------------------------------------

export interface AGUIAdapterOptions<TDeps> {
  /** Dependencies injected into every agent run. */
  deps?: TDeps;
  /**
   * Optional callback to retrieve the current agent state, which is sent
   * as a STATE_SNAPSHOT event before RUN_FINISHED.
   */
  getState?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
}

/**
 * Adapts a framework `Agent` to the AG-UI protocol, producing Server-Sent
 * Events responses from `AGUIRunInput` objects.
 *
 * @example
 * ```ts
 * const adapter = new AGUIAdapter(agent, { deps: myDeps });
 *
 * // Deno HTTP server
 * Deno.serve(adapter.handler());
 *
 * // Direct request handling
 * const response = adapter.handleRequest(input);
 * ```
 */
export class AGUIAdapter<TDeps, TOutput> {
  private readonly agent: Agent<TDeps, TOutput>;
  private readonly options: AGUIAdapterOptions<TDeps>;

  constructor(
    agent: Agent<TDeps, TOutput>,
    options: AGUIAdapterOptions<TDeps> = {},
  ) {
    this.agent = agent;
    this.options = options;
  }

  /**
   * Handle an AG-UI `AGUIRunInput` and return a Server-Sent Events
   * `Response`. The stream is opened immediately and events are written as
   * they are produced by the underlying agent run.
   */
  handleRequest(input: AGUIRunInput): Response {
    const threadId = input.threadId;
    const runId = input.runId ?? generateId("run");
    const { prompt, messageHistory } = convertMessages(input.messages);
    const { deps, getState } = this.options;
    const agent = this.agent;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (event: AGUIEvent): void => {
          controller.enqueue(encode(formatSSE(event)));
        };

        try {
          enqueue({ type: "RUN_STARTED", threadId, runId });

          // State snapshot from input or adapter-level state
          const initialState = input.state ??
            (getState ? await getState() : null);
          if (initialState !== null && initialState !== undefined) {
            enqueue({ type: "STATE_SNAPSHOT", snapshot: initialState });
          }

          // Track active text message for TEXT_MESSAGE_* lifecycle
          let currentMessageId: string | null = null;
          let turnNumber = 0;
          // Track pending tool calls (started but not yet ended) so they can
          // be closed before emitting RUN_ERROR on stream failure.
          const pendingToolCallIds = new Set<string>();

          const eventStream = agent.runStreamEvents(prompt, {
            deps: deps as TDeps,
            messageHistory,
          });

          for await (const event of eventStream) {
            switch (event.kind) {
              case "turn-start": {
                turnNumber = event.turn;
                enqueue({
                  type: "STEP_STARTED",
                  stepName: `turn-${turnNumber}`,
                });
                break;
              }

              case "text-delta": {
                if (currentMessageId === null) {
                  // First text delta for this message - emit TEXT_MESSAGE_START
                  currentMessageId = generateId("msg");
                  enqueue({
                    type: "TEXT_MESSAGE_START",
                    messageId: currentMessageId,
                    role: "assistant",
                  });
                }
                enqueue({
                  type: "TEXT_MESSAGE_CONTENT",
                  messageId: currentMessageId,
                  delta: event.delta,
                });
                break;
              }

              case "tool-call-start": {
                // Close any open text message before the tool call
                if (currentMessageId !== null) {
                  enqueue({
                    type: "TEXT_MESSAGE_END",
                    messageId: currentMessageId,
                  });
                  currentMessageId = null;
                }
                pendingToolCallIds.add(event.toolCallId);
                enqueue({
                  type: "TOOL_CALL_START",
                  toolCallId: event.toolCallId,
                  toolCallName: event.toolName,
                });
                // Emit args as a single delta using JSON serialisation
                const argsDelta = JSON.stringify(event.args);
                enqueue({
                  type: "TOOL_CALL_ARGS",
                  toolCallId: event.toolCallId,
                  delta: argsDelta,
                });
                break;
              }

              case "tool-call-result": {
                pendingToolCallIds.delete(event.toolCallId);
                enqueue({
                  type: "TOOL_CALL_END",
                  toolCallId: event.toolCallId,
                });
                break;
              }

              case "usage-update": {
                enqueue({
                  type: "RAW",
                  event: "usage",
                  source: JSON.stringify(event.usage),
                });
                enqueue({
                  type: "STEP_FINISHED",
                  stepName: `turn-${turnNumber}`,
                });
                break;
              }

              case "final-result": {
                // Close any still-open text message
                if (currentMessageId !== null) {
                  enqueue({
                    type: "TEXT_MESSAGE_END",
                    messageId: currentMessageId,
                  });
                  currentMessageId = null;
                }

                // Emit final state snapshot
                const finalState = getState
                  ? await getState()
                  : { output: event.output as unknown };
                enqueue({ type: "STATE_SNAPSHOT", snapshot: finalState });
                break;
              }

              case "error": {
                const errorObj = event.error;
                const message = errorObj instanceof Error
                  ? errorObj.message
                  : String(errorObj);
                // Close any pending tool calls before emitting the error so the
                // UI doesn't show them as still running.
                for (const toolCallId of pendingToolCallIds) {
                  enqueue({ type: "TOOL_CALL_END", toolCallId });
                }
                pendingToolCallIds.clear();
                enqueue({ type: "RUN_ERROR", message });
                controller.close();
                return;
              }

              case "partial-output": {
                // Partial outputs are implementation details; skip in AG-UI stream
                break;
              }
            }
          }

          enqueue({ type: "RUN_FINISHED", threadId, runId });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encode(
              formatSSE({ type: "RUN_ERROR", message }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  /**
   * Returns a Deno-compatible HTTP request handler that parses the JSON body
   * as `AGUIRunInput` and delegates to `handleRequest`.
   *
   * @example
   * ```ts
   * Deno.serve(adapter.handler());
   * ```
   */
  handler(): (req: Request) => Promise<Response> {
    return async (req: Request): Promise<Response> => {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      let input: AGUIRunInput;
      try {
        const body: unknown = await req.json();
        input = validateAGUIRunInput(body);
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : "Invalid request body";
        return new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      return this.handleRequest(input);
    };
  }
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateAGUIRunInput(raw: unknown): AGUIRunInput {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["threadId"] !== "string" || obj["threadId"].length === 0) {
    throw new Error("threadId must be a non-empty string");
  }

  if (obj["runId"] !== undefined && typeof obj["runId"] !== "string") {
    throw new Error("runId must be a string when provided");
  }

  if (!Array.isArray(obj["messages"])) {
    throw new Error("messages must be an array");
  }

  const messages: AGUIMessage[] = [];
  for (const item of obj["messages"]) {
    if (item === null || typeof item !== "object") {
      throw new Error("Each message must be a JSON object");
    }
    const msg = item as Record<string, unknown>;
    if (msg["role"] !== "user" && msg["role"] !== "assistant") {
      throw new Error('Message role must be "user" or "assistant"');
    }
    if (typeof msg["content"] !== "string") {
      throw new Error("Message content must be a string");
    }
    messages.push({
      role: msg["role"] as "user" | "assistant",
      content: msg["content"] as string,
    });
  }

  let state: Record<string, unknown> | undefined;
  if (obj["state"] !== undefined) {
    if (
      obj["state"] === null || typeof obj["state"] !== "object" ||
      Array.isArray(obj["state"])
    ) {
      throw new Error("state must be a JSON object when provided");
    }
    state = obj["state"] as Record<string, unknown>;
  }

  return {
    threadId: obj["threadId"] as string,
    runId: obj["runId"] as string | undefined,
    messages,
    state,
  };
}
