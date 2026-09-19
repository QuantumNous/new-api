'use client';

import ChatInput from '@/components/chat-input';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { createIdGenerator, DefaultChatTransport } from 'ai';

export default function Chat({
  id,
  initialMessages,
}: { id?: string | undefined; initialMessages?: UIMessage[] } = {}) {
  const { sendMessage, status, messages, stop } = useChat({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat/resilient-persistence',
    }),
    generateId: createIdGenerator({ prefix: 'msgc', size: 16 }), // id format for client-side messages
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {m.role === 'user' ? 'User: ' : 'AI: '}
          {m.parts
            .map(part => (part.type === 'text' ? part.text : ''))
            .join('')}
        </div>
      ))}

      <ChatInput
        status={status}
        stop={stop}
        onSubmit={text => sendMessage({ text })}
      />
    </div>
  );
}
