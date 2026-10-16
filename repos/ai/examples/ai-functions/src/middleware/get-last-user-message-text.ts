import type { LanguageModelV4Prompt } from '@ai-sdk/provider';

export function getLastUserMessageText({
  prompt,
}: {
  prompt: LanguageModelV4Prompt;
}): string | undefined {
  const lastMessage = prompt.at(-1);

  if (lastMessage?.role !== 'user') {
    return undefined;
  }

  return lastMessage.content.length === 0
    ? undefined
    : lastMessage.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
}
