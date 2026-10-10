'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ChatInput from '@/components/chat-input';

export default function TestOpenAIResponses() {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat/openai-responses' }),
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <h1 className="mb-4 text-xl font-bold">
        OpenAI Responses Block-Based Streaming Test
      </h1>

      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap mb-4">
          <div className="font-semibold mb-1">
            {m.role === 'user' ? 'User:' : 'AI:'}
          </div>
          {m.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            } else if (part.type === 'reasoning') {
              return (
                <div
                  key={index}
                  className="mt-2 p-2 bg-blue-50 border-l-2 border-blue-300 text-blue-800 text-sm"
                >
                  <strong>Reasoning:</strong> {part.text}
                </div>
              );
            }
          })}
        </div>
      ))}

      {(status === 'submitted' || status === 'streaming') && (
        <div className="mt-4 text-gray-500">
          {status === 'submitted' && <div>Loading...</div>}
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md"
            onClick={stop}
          >
            Stop
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <div className="text-red-500">An error occurred.</div>
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md"
            onClick={() => regenerate()}
          >
            Retry
          </button>
        </div>
      )}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
