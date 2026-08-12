'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useLayoutEffect, useRef } from 'react';

export default function Chat() {
  const renderCount = useRef(0);
  useLayoutEffect(() => {
    console.log(`component rendered #${++renderCount.current}`);
  });

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat/throttle' }),
    experimental_throttle: 50,
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <h4 className="pb-4 text-xl font-bold text-gray-900 md:text-xl">
        useChat throttle example
      </h4>
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {m.role === 'user' ? 'User: ' : 'AI: '}
          {m.parts
            .map(part => (part.type === 'text' ? part.text : ''))
            .join('')}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
