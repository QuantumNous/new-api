'use client';

import { Card } from '@/app/components';
import { useChat } from '@ai-sdk/react';
import { getStaticToolName, isStaticToolUIPart } from 'ai';
import { GeistMono } from 'geist/font/mono';
import { useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 p-4">
        {messages.map(message => (
          <div key={message.id} className="flex flex-row gap-2">
            <div className="flex-shrink-0 w-24 text-zinc-500">{`${message.role}: `}</div>

            <div className="flex flex-col gap-2">
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return <div key={index}>{part.text}</div>;
                } else if (isStaticToolUIPart(part)) {
                  return (
                    <div
                      key={index}
                      className={`${GeistMono.className} text-sm text-zinc-500 bg-zinc-100 p-3 rounded-lg`}
                    >
                      {`${getStaticToolName(part)}(${JSON.stringify(
                        part.input,
                        null,
                        2,
                      )})`}
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ))}
      </div>

      {messages.length === 0 && <Card type="chat-data" />}

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
        className="flex fixed bottom-0 flex-col w-full border-t"
      >
        <input
          value={input}
          placeholder="What's the weather in San Francisco?"
          onChange={e => setInput(e.target.value)}
          className="p-4 w-full bg-transparent outline-none"
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
