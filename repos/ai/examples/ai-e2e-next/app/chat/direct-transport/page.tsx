'use client';

import { useChat, type UIMessage } from '@ai-sdk/react';
import ChatInput from '@/components/chat-input';
import {
  convertToModelMessages,
  streamText,
  toUIMessageStream,
  type ChatTransport,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Note: this needs a client-side OpenAI API key to work.
// DO NOT USE THIS IN ENVIRONMENTS WHERE THE API KEY IS CONFIDENTIAL.
const openai = createOpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    transport: {
      sendMessages: async ({ messages, abortSignal }) => {
        const result = streamText({
          model: openai('gpt-4o'),
          messages: await convertToModelMessages(messages),
          abortSignal,
        });

        return toUIMessageStream({ stream: result.stream });
      },

      reconnectToStream: async ({ chatId }) => {
        throw new Error('Not implemented');
      },
    } satisfies ChatTransport<UIMessage>,
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {m.role === 'user' ? 'User: ' : 'AI: '}
          {m.parts.map(part => {
            if (part.type === 'text') {
              return part.text;
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
