import { Box, Text } from "ink";
import { AssistantEntry } from "./assistant_entry.tsx";
import type { ConversationEntry } from "../types.ts";

interface ConversationViewProps {
  entries: ConversationEntry[];
}

function WelcomeScreen() {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} justifyContent="center" alignItems="center">
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Text bold color="cyan">vibes</Text>
        <Text dimColor>AI agent for your terminal</Text>
        <Box flexDirection="column" marginTop={1} gap={0}>
          <Text dimColor>Type a prompt and press Enter to start.</Text>
          <Text dimColor>Ctrl+C to exit.</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function ConversationView({ entries }: ConversationViewProps) {
  if (entries.length === 0) {
    return <WelcomeScreen />;
  }

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {entries.map((entry) => {
        if (entry.kind === "user") {
          return (
            <Box key={entry.id} flexDirection="column" marginBottom={1}>
              <Text color="cyan">&gt; {entry.content}</Text>
            </Box>
          );
        }
        return <AssistantEntry key={entry.id} {...entry} />;
      })}
    </Box>
  );
}
