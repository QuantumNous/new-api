'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';
import { ChatContainer } from '../../components/chat-container';
import type { CustomDataMessage } from '../types';

export default function ReasoningChat() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/reasoning' }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>({
    transport,
  });

  return (
    <ChatContainer
      title="Reasoning Example"
      description={
        <>
          Uses <code>ChatOpenAI</code> with OpenAI Responses API and reasoning
          enabled. This streams reasoning summaries before the final response,
          demonstrating the <code>@ai-sdk/langchain</code> adapter&apos;s
          support for reasoning content.
        </>
      }
      messages={messages}
      onSend={text => sendMessage({ text })}
      status={status}
      error={error}
      placeholder="Ask a question that requires reasoning..."
      suggestions={[
        'How many rs are in strawberry?',
        'What is 15% of 80?',
        'If I have 3 apples and give away half, how many do I have?',
      ]}
    />
  );
}
