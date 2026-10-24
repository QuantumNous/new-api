// @ts-nocheck
import { useChat, DefaultChatTransport } from '@ai-sdk/react';

export function ChatWithApiString() {
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat'
    })
  });

  return messages;
}

export function ChatWithApiAndOptions() {
  const { messages, sendMessage } = useChat({
    onError: (error) => console.error(error),
    initialMessages: [],

    transport: new DefaultChatTransport({
      api: '/api/custom-chat'
    })
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
    maxSteps: 5,

    transport: new DefaultChatTransport({
      api: apiEndpoint
    })
  });

  return messages;
}

export function ChatWithComplexApi() {
  const baseUrl = 'https://api.example.com';
  const { messages, sendMessage, isLoading } = useChat({
    onError: handleError,
    onFinish: handleFinish,

    transport: new DefaultChatTransport({
      api: `${baseUrl}/chat`
    })
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
    transport: new DefaultChatTransport({
      api: '/api/new-chat'
    })
  });
  return messages;
}