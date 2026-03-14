import React from "react";
import { Box, Text } from "ink";
import type { Usage } from "@vibes/framework";
import type { AgentState } from "../types.ts";

interface StatusBarProps {
  agentState: AgentState;
  usage: Usage | null;
  turnCount: number;
}

const STATE_LABELS: Record<AgentState, string> = {
  idle: "ready",
  streaming: "streaming",
  complete: "done",
  error: "error",
};

const STATE_COLORS: Record<AgentState, string> = {
  idle: "green",
  streaming: "yellow",
  complete: "cyan",
  error: "red",
};

export function StatusBar({ agentState, usage, turnCount }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Text>
        <Text bold>status:</Text>{" "}
        <Text color={STATE_COLORS[agentState]}>{STATE_LABELS[agentState]}</Text>
        {"  "}
        <Text bold>turns:</Text> {turnCount}
      </Text>
      {usage && (
        <Text>
          <Text bold>tokens:</Text> in={usage.inputTokens} out={usage.outputTokens} total=
          {usage.totalTokens} reqs={usage.requests}
        </Text>
      )}
    </Box>
  );
}
