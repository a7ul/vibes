import { useState, useCallback, useEffect, useMemo } from "react";
import process from "node:process";
import { Box, useApp, useInput } from "ink";
import { createCoreAgent } from "../../agents/core_agent/agent.ts";
import { ensureSandboxDirs, sandboxDir } from "../../file_system.ts";
import { initSandbox } from "../../sandbox.ts";
import { InputBox } from "./components/input_box.tsx";
import { ConversationView } from "./components/conversation_view.tsx";
import { StatusBar } from "./components/status_bar.tsx";
import { ErrorBanner } from "./components/error_banner.tsx";
import { useVibesAgent } from "./hooks/use_vibes_agent.ts";
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
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const agent = useMemo(() => createCoreAgent(), []);
  const { entries, send, state, usage, currentTurn, error } = useVibesAgent(agent);

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

      const deps: CoreAgentDeps = {
        workflowId: config.workflowId,
        contextDir: config.contextDir,
        runId: generateRunId(),
      };

      await send(trimmed, deps);
    },
    [state, config, send],
  );

  const errorMessage = error ?? initError;

  return (
    <Box flexDirection="column" height={process.stdout.rows ?? 24}>
      <ConversationView entries={entries} />
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <StatusBar usage={usage} currentTurn={currentTurn} />
      {initialized && (
        <InputBox
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          agentState={state}
        />
      )}
    </Box>
  );
}
