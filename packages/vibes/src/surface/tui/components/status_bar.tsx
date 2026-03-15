import { Box, Text } from "ink";
import type { Usage } from "@vibesjs/sdk";
import { MODEL, MAX_TURNS } from "../../../constants.ts";

interface StatusBarProps {
  usage: Usage | null;
  currentTurn: number;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function StatusBar({ usage, currentTurn }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Text>
        <Text dimColor>{MODEL}</Text>
        {" · "}
        <Text>turn {currentTurn}/{MAX_TURNS}</Text>
      </Text>
      {usage && (
        <Text dimColor>
          ↑{formatTokens(usage.inputTokens)} ↓{formatTokens(usage.outputTokens)} tokens
        </Text>
      )}
    </Box>
  );
}
