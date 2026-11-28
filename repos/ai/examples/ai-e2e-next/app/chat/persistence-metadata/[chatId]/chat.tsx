'use client';

import ChatInput from '@/components/chat-input';
import { zodSchema } from '@ai-sdk/provider-utils';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { z } from 'zod';

export default function Chat({
  id,
  initialMessages,
}: {
  id?: string | undefined;
  initialMessages?: UIMessage<{ createdAt: string }>[];
} = {}) {
  const { sendMessage, status, messages } = useChat({
    id, // use the provided chatId
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat/persistence-metadata',
    }),
    messageMetadataSchema: zodSchema(
      z.object({
        createdAt: z.string().datetime(),
      }),
    ),
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {m.role === 'user' ? 'User: ' : 'AI: '}
          {m.metadata?.createdAt && (
            <div>
              Created at: {new Date(m.metadata.createdAt).toLocaleString()}
            </div>
          )}
          {m.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
