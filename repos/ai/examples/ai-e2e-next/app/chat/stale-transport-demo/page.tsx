'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Page() {
  const [subagent, setSubagent] = useState('todos-agent');

  const { messages, sendMessage, status } = useChat({
    // A new transport is created with the current `subagent` on each render
    transport: new DefaultChatTransport({
      api: '/api/chat/stale-transport-demo',
      body: { subagent },
    }),
  });

  return (
    <div className="flex flex-col w-full max-w-lg py-12 mx-auto gap-4">
      <h4 className="text-xl font-bold">
        useChat stale transport demo (#7819)
      </h4>

      <div className="flex items-center gap-2">
        <span>Current subagent state:</span>
        <strong data-testid="subagent">{subagent}</strong>
      </div>

      <div className="flex gap-2">
        <button
          className="px-3 py-1 border rounded"
          onClick={() => setSubagent('todos-agent')}
        >
          set todos-agent
        </button>
        <button
          className="px-3 py-1 border rounded"
          onClick={() => setSubagent('research-agent')}
        >
          set research-agent
        </button>
      </div>

      <button
        className="px-3 py-1 text-white bg-black rounded disabled:opacity-50"
        disabled={status !== 'ready'}
        onClick={() => sendMessage({ text: 'what did the server receive?' })}
      >
        Send message
      </button>

      <div className="flex flex-col gap-2">
        {messages.map(message => (
          <div key={message.id} className="whitespace-pre-wrap">
            {message.role === 'user' ? 'User: ' : 'AI: '}
            {message.parts
              .map(part => (part.type === 'text' ? part.text : ''))
              .join('')}
          </div>
        ))}
      </div>
    </div>
  );
}
