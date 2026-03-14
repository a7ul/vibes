import React from "react";
import { Box, Text } from "ink";

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <Box borderStyle="round" borderColor="red" paddingX={1} marginBottom={1}>
      <Text color="red" bold>
        Error:{" "}
      </Text>
      <Text color="red">{message}</Text>
    </Box>
  );
}
