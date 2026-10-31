import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';

export function addToLastUserMessage({
  text,
  params,
}: {
  text: string;
  params: LanguageModelV4CallOptions;
}): LanguageModelV4CallOptions {
  const { prompt, ...rest } = params;

  const lastMessage = prompt.at(-1);

  if (lastMessage?.role !== 'user') {
    return params;
  }

  return {
    ...rest,
    prompt: [
      ...prompt.slice(0, -1),
      {
        ...lastMessage,
        content: [{ type: 'text', text }, ...lastMessage.content],
      },
    ],
  };
}
