import type {
  LanguageModelV4Content,
  LanguageModelV4Reasoning,
} from '@ai-sdk/provider';

export function extractReasoningContent(
  content: LanguageModelV4Content[],
): string | undefined {
  const parts = content.filter(
    (content): content is LanguageModelV4Reasoning =>
      content.type === 'reasoning',
  );

  return parts.length === 0
    ? undefined
    : parts.map(content => content.text).join('\n');
}
