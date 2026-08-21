'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';
import { ChatContainer } from '../../components/chat-container';
import type { CustomDataMessage } from '../types';

export default function LangGraphChat() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/langgraph' }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>({
    transport,
  });

  return (
    <ChatContainer
      title="LangGraph Example"
      description={
        <>
          Uses LangGraph&apos;s <code>StateGraph</code> with{' '}
          <code>MessagesAnnotation</code> to create a simple agent workflow.
          Messages are converted using <code>toBaseMessages</code> and streamed
          back with <code>toUIMessageStream</code>.
        </>
      }
      messages={messages}
      onSend={text => sendMessage({ text })}
      status={status}
      error={error}
      placeholder="Ask anything..."
      suggestions={[
        'What is LangGraph?',
        'Explain state machines',
        'How do agents work?',
      ]}
    />
  );
}
