import { Box, Text } from "ink";

interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
}

export function AssistantMessage({ content, isStreaming = false }: AssistantMessageProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>
        assistant
      </Text>
      <Box paddingLeft={2}>
        <Text>
          {content}
          {isStreaming && <Text color="green">▊</Text>}
        </Text>
      </Box>
    </Box>
  );
}
