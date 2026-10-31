'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { SourcesChatMessage } from '@/app/api/chat/sources/route';

export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } =
    useChat<SourcesChatMessage>({
      transport: new DefaultChatTransport({ api: '/api/chat/sources' }),
    });

  console.log(messages);

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            }

            if (part.type === 'tool-web_search') {
              if (
                part.state === 'input-available' ||
                part.state === 'input-streaming'
              ) {
                return (
                  <pre
                    key={index}
                    className="overflow-auto p-2 text-sm bg-gray-100 rounded"
                  >
                    {JSON.stringify(part.input, null, 2)}
                  </pre>
                );
              }
              if (part.state === 'output-available') {
                return (
                  <pre
                    key={index}
                    className="overflow-auto p-2 text-sm bg-gray-100 rounded"
                  >
                    {JSON.stringify(part.input, null, 2)}
                    {`\n\nDONE - ${part.output.length} results`}
                  </pre>
                );
              }
            }

            if (part.type === 'source-url') {
              return (
                <span key={index}>
                  [
                  <a
                    href={part.url}
                    target="_blank"
                    className="text-sm font-bold text-blue-500 hover:underline"
                  >
                    {part.title ?? new URL(part.url).hostname}
                  </a>
                  ]
                </span>
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
            className="px-4 py-2 mt-4 text-blue-500 rounded-md border border-blue-500"
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
            className="px-4 py-2 mt-4 text-blue-500 rounded-md border border-blue-500"
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
