import { Box, Text } from "ink";
import { AssistantEntry } from "./assistant_entry.tsx";
import type { ConversationEntry } from "../types.ts";

interface ConversationViewProps {
  entries: ConversationEntry[];
}

export function ConversationView({ entries }: ConversationViewProps) {
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
