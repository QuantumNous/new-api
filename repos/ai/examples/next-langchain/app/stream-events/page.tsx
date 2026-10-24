'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';
import { ChatContainer } from '../../components/chat-container';
import type { CustomDataMessage } from '../types';

export default function StreamEventsChat() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/stream-events' }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>({
    transport,
  });

  return (
    <ChatContainer
      title="streamEvents Example"
      description={
        <>
          Uses LangChain&apos;s <code>streamEvents()</code> method for granular
          semantic events. Ideal for debugging, observability, and migrating
          LCEL apps. Compare with LangGraph&apos;s <code>stream()</code> for
          state-based workflows.
        </>
      }
      messages={messages}
      onSend={text => sendMessage({ text })}
      status={status}
      error={error}
      placeholder="Ask anything..."
      suggestions={[
        'Tell me a short story',
        'Explain streaming in LangChain',
        'What is the weather like today?',
      ]}
    />
  );
}
