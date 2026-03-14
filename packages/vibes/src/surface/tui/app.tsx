import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Box, useApp, useInput } from "ink";
import { createCoreAgent } from "../../agents/core_agent/agent.ts";
import { ensureSandboxDirs, sandboxDir } from "../../file_system.ts";
import { initSandbox } from "../../sandbox.ts";
import { InputBox } from "./components/input_box.tsx";
import { MessageList } from "./components/message_list.tsx";
import { ToolIndicator } from "./components/tool_indicator.tsx";
import { StatusBar } from "./components/status_bar.tsx";
import { ErrorBanner } from "./components/error_banner.tsx";
import { useAgent } from "./hooks/use_agent.ts";
import { useConversation } from "./hooks/use_conversation.ts";
import type { TuiConfig } from "./types.ts";
import type { CoreAgentDeps } from "../../types.ts";

function generateRunId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

interface AppProps {
  config: TuiConfig;
}

export function App({ config }: AppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [turnCount, setTurnCount] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const agent = useMemo(() => createCoreAgent(), []);
  const { state, streamedText, usage, error, send } = useAgent(agent);
  const { messages, addMessage } = useConversation();

  useEffect(() => {
    ensureSandboxDirs(config.workflowId)
      .then(() => initSandbox(sandboxDir(config.workflowId)))
      .then(() => setInitialized(true))
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err.message : String(err));
        setInitialized(true);
      });
  }, [config.workflowId]);

  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      exit();
    }
  });

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || state === "streaming") return;

      setInput("");
      addMessage("user", trimmed);
      setTurnCount((n) => n + 1);

      const deps: CoreAgentDeps = {
        workflowId: config.workflowId,
        contextDir: config.contextDir,
        runId: generateRunId(),
      };

      await send(trimmed, deps);

      if (state !== "error" && streamedText) {
        addMessage("assistant", streamedText);
      }
    },
    [state, streamedText, config, addMessage, send],
  );

  const errorMessage = error ?? initError;

  return (
    <Box flexDirection="column" height={process.stdout.rows ?? 24}>
      <MessageList messages={messages} streamedText={streamedText} isStreaming={state === "streaming"} />
      <ToolIndicator agentState={state} />
      {errorMessage && <ErrorBanner message={errorMessage} />}
      {initialized && (
        <InputBox
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          agentState={state}
        />
      )}
      <StatusBar agentState={state} usage={usage} turnCount={turnCount} />
    </Box>
  );
}
