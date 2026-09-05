'use client';

import type { BedrockInvalidToolCallMessage } from '@/app/api/chat/bedrock-invalid-tool-call/route';
import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, status, error, regenerate } =
    useChat<BedrockInvalidToolCallMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/bedrock-invalid-tool-call',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <div className="mb-4 text-sm text-gray-500">
        1. Send a message — the model emits a malformed tool call (persisted in
        the chat history).
        <br />
        2. Send a second message — the history is replayed to Bedrock, which
        rejects the raw-string tool input.
      </div>

      {messages.map(message => (
        <div key={message.id} className="mb-4 whitespace-pre-wrap">
          <strong>{`${message.role}: `}</strong>
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            }

            if (part.type === 'step-start') {
              return null;
            }

            return (
              <pre
                key={index}
                className="p-2 mt-1 text-xs text-gray-500 bg-gray-100 rounded overflow-x-auto"
              >
                {JSON.stringify(part, null, 2)}
              </pre>
            );
          })}
        </div>
      ))}

      {error && (
        <div className="mt-4">
          <div className="text-red-500">{error.message}</div>
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
