'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { status, sendMessage, messages, error, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat/google-gemini-image-thinking',
    }),
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            } else if (part.type === 'reasoning') {
              return (
                <div
                  key={index}
                  className="italic text-gray-500 whitespace-pre-wrap"
                >
                  {part.text}
                </div>
              );
            } else if (
              (part.type === 'file' || part.type === 'reasoning-file') &&
              part.mediaType.startsWith('image/')
            ) {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={index} src={part.url} alt="Generated image" />
              );
            }
          })}
        </div>
      ))}

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
