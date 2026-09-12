import type {
  LanguageModelV4Content,
  LanguageModelV4Text,
} from '@ai-sdk/provider';

export function extractTextContent(
  content: LanguageModelV4Content[],
): string | undefined {
  const parts = content.filter(
    (content): content is LanguageModelV4Text => content.type === 'text',
  );

  if (parts.length === 0) {
    return undefined;
  }

  return parts.map(content => content.text).join('');
}
