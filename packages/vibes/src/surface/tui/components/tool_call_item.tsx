import { Box, Text } from "ink";
import Spinner from "ink-spinner";

interface ToolCallItemProps {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "running" | "done";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatArgs(args: Record<string, unknown>): string {
  const values = Object.values(args);
  if (values.length === 1 && typeof values[0] === "string") {
    return values[0];
  }
  return JSON.stringify(args);
}

export function ToolCallItem({ toolName, args, result, status }: ToolCallItemProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {status === "running"
          ? (
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
          )
          : <Text color="green">✓</Text>}
        <Text> {toolName}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor>&gt; {truncate(formatArgs(args), 80)}</Text>
      </Box>
      {result !== undefined && status === "done" && (
        <Box paddingLeft={2}>
          <Text dimColor>↳ {truncate(String(result), 80)}</Text>
        </Box>
      )}
    </Box>
  );
}
