import { Box, Text } from "ink";
import { ToolCallItem } from "./tool_call_item.tsx";
import { TextBlock } from "./text_block.tsx";
import type { ConversationEntry } from "../types.ts";

type AssistantEntryProps = Extract<ConversationEntry, { kind: "assistant" }>;

export function AssistantEntry({ items, status, errorMessage }: AssistantEntryProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {items.map((item, i) => {
        if (item.kind === "tool-call") {
          return <ToolCallItem key={item.toolCallId} {...item} />;
        }
        const isLastItem = i === items.length - 1;
        const showCursor = isLastItem && status === "streaming";
        return <TextBlock key={i} content={item.content} showCursor={showCursor} />;
      })}
      {status === "error" && errorMessage && (
        <Text color="red">{errorMessage}</Text>
      )}
    </Box>
  );
}
