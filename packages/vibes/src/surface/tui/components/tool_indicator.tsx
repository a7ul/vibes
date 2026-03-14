import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { AgentState } from "../types.ts";

interface ToolIndicatorProps {
  agentState: AgentState;
}

export function ToolIndicator({ agentState }: ToolIndicatorProps) {
  if (agentState !== "streaming") return null;

  return (
    <Box marginBottom={1}>
      <Text color="yellow">
        <Spinner type="dots" />
      </Text>
      <Text color="yellow"> Agent is working...</Text>
    </Box>
  );
}
