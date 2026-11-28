// @ts-nocheck
import { useChat } from 'ai/react';

export function ChatWithApiString() {
  const { messages, sendMessage } = useChat({
    api: '/api/chat',
  });

  return messages;
}

export function ChatWithApiAndOptions() {
  const { messages, sendMessage } = useChat({
    api: '/api/custom-chat',
    onError: (error) => console.error(error),
    initialMessages: [],
  });

  return messages;
}

export function ChatWithoutApi() {
  const { messages, sendMessage } = useChat({
    onError: (error) => console.error(error),
  });

  return messages;
}

export function ChatWithApiVariable() {
  const apiEndpoint = '/api/chat';
  const { messages, sendMessage } = useChat({
    api: apiEndpoint,
    maxSteps: 5,
  });

  return messages;
}

export function ChatWithComplexApi() {
  const baseUrl = 'https://api.example.com';
  const { messages, sendMessage, isLoading } = useChat({
    api: `${baseUrl}/chat`,
    onError: handleError,
    onFinish: handleFinish,
  });

  return { messages, isLoading };
}

export function EmptyUseChat() {
  const { messages } = useChat();
  return messages;
}

// Test with new import syntax
import { useChat as useChatNew } from '@ai-sdk/react';

export function ChatWithNewImportSyntax() {
  const { messages, sendMessage } = useChatNew({
    api: '/api/new-chat',
  });
  return messages;
}