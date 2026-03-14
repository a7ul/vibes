import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { AgentSessionState } from "../types.ts";

interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  agentState: AgentSessionState;
}

export function InputBox({ value, onChange, onSubmit, agentState }: InputBoxProps) {
  const isDisabled = agentState === "streaming";
  const prompt = isDisabled ? "…" : ">";

  return (
    <Box borderStyle="round" paddingX={1}>
      <Text color="green" bold>
        {prompt}{" "}
      </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        focus={!isDisabled}
        placeholder={isDisabled ? "Agent is working..." : "Type your message and press Enter"}
      />
    </Box>
  );
}
