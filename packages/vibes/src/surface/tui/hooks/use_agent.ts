import { useState, useCallback, useRef } from "react";
import type { Agent, Usage } from "@vibes/framework";
import type { CoreAgentDeps, CoreAgentOutput } from "../../../types.ts";
import type { AgentState } from "../types.ts";

export interface UseAgentResult {
  state: AgentState;
  streamedText: string;
  usage: Usage | null;
  error: string | null;
  send: (prompt: string, deps: CoreAgentDeps) => Promise<void>;
}

export function useAgent(agent: Agent<CoreAgentDeps, CoreAgentOutput>): UseAgentResult {
  const [state, setState] = useState<AgentState>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (prompt: string, deps: CoreAgentDeps) => {
    if (state === "streaming") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("streaming");
    setStreamedText("");
    setError(null);

    try {
      const stream = agent.stream(prompt, { deps });

      for await (const chunk of stream.textStream) {
        if (controller.signal.aborted) break;
        setStreamedText((prev) => prev + chunk);
      }

      if (!controller.signal.aborted) {
        const finalUsage = await stream.usage;
        setUsage(finalUsage);
        setState("complete");
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(formatError(err));
        setState("error");
      }
    }
  }, [agent, state]);

  return { state, streamedText, usage, error, send };
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "MaxTurnsError") return `Max turns reached: ${err.message}`;
    if (err.name === "MaxRetriesError") return `Max retries reached: ${err.message}`;
    return err.message;
  }
  return String(err);
}
