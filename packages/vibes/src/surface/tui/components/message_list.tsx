import React from "react";
import { Box, Text } from "ink";
import { AssistantMessage } from "./assistant_message.tsx";
import type { TuiMessage } from "../types.ts";

interface MessageListProps {
  messages: TuiMessage[];
  streamedText: string;
  isStreaming: boolean;
}

function UserMessage({ content }: { content: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="green" bold>
        you
      </Text>
      <Box paddingLeft={2}>
        <Text>{content}</Text>
      </Box>
    </Box>
  );
}

export function MessageList({ messages, streamedText, isStreaming }: MessageListProps) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((msg) =>
        msg.role === "user" ? (
          <UserMessage key={msg.id} content={msg.content} />
        ) : (
          <AssistantMessage key={msg.id} content={msg.content} />
        ),
      )}
      {isStreaming && streamedText && (
        <AssistantMessage content={streamedText} isStreaming={true} />
      )}
    </Box>
  );
}
