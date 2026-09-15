'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Link from 'next/link';
import ChatInput from '@/components/chat-input';

export function Chat({
  id,
  autoResume,
  initialMessages = [],
}: {
  id: string;
  autoResume: boolean;
  initialMessages: UIMessage[];
}) {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: '/api/chat/resume' }),
    onError: error => {
      console.error('Error streaming text:', error);
    },
    resume: autoResume,
  });

  return (
    <div className="flex flex-col gap-8 py-24 mx-auto w-full max-w-md stretch">
      <Link href={`/chat/resume/${id}`} target="_noblank">
        Chat Id: {id}
      </Link>

      <div>Status: {status}</div>

      {messages.map(message => (
        <div key={message.id} className="flex flex-row whitespace-pre-wrap">
          <div className="min-w-12">
            {message.role === 'user' ? 'User: ' : 'AI: '}
          </div>

          <div>
            <div className="text-sm text-zinc-500">{message.id}</div>
            {message.parts.map((part, partIndex) => {
              if (part.type === 'text') {
                return (
                  <div key={`${message.id}-${partIndex}`}>{part.text}</div>
                );
              }
            })}
          </div>
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
