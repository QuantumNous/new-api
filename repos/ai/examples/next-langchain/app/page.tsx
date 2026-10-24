'use client';

import { useChat } from '@ai-sdk/react';
import { ChatContainer } from '../components/chat-container';
import type { CustomDataMessage } from './types';

export default function Chat() {
  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>();

  return (
    <ChatContainer
      title="Basic Chat"
      description={
        <>
          Simple LangChain integration using <code>toBaseMessages</code> and{' '}
          <code>toUIMessageStream</code> to stream responses from ChatOpenAI.
        </>
      }
      messages={messages}
      onSend={text => sendMessage({ text })}
      status={status}
      error={error}
      placeholder="Say something..."
      suggestions={[
        'Explain how LangChain works',
        'Write a haiku about coding',
        'What can you help me with?',
      ]}
    />
  );
}
