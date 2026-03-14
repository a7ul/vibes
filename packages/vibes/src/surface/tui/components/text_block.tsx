import { Text } from "ink";

interface TextBlockProps {
  content: string;
  showCursor?: boolean;
}

export function TextBlock({ content, showCursor = false }: TextBlockProps) {
  return (
    <Text>
      {content}
      {showCursor && <Text color="green">▊</Text>}
    </Text>
  );
}
