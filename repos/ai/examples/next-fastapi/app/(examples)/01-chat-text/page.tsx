'use client';

import { Card } from '@/app/components';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({
      api: '/api/chat?protocol=text',
    }),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 p-4">
        {messages.map(message => (
          <div key={message.id} className="flex flex-row gap-2">
            <div className="flex-shrink-0 w-24 text-zinc-500">{`${message.role}: `}</div>
            <div className="flex flex-col gap-2">
              {message.parts
                .map(part => (part.type === 'text' ? part.text : ''))
                .join('')}
            </div>
          </div>
        ))}
      </div>

      {messages.length === 0 && <Card type="chat-text" />}

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
        className="fixed bottom-0 flex flex-col w-full border-t"
      >
        <input
          value={input}
          placeholder="Why is the sky blue?"
          onChange={e => setInput(e.target.value)}
          className="w-full p-4 bg-transparent outline-none"
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
