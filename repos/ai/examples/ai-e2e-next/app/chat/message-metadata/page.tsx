'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import type { ExampleMetadata } from '@/agent/openai/metadata-agent';

type MyMessage = UIMessage<ExampleMetadata>;

export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } =
    useChat<MyMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/message-metadata',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.metadata?.createdAt && (
            <div>
              Created at:{' '}
              {new Date(message.metadata.createdAt).toLocaleString()}
            </div>
          )}
          {message.metadata?.duration && (
            <div>Duration: {message.metadata.duration}ms</div>
          )}
          {message.metadata?.model && (
            <div>Model: {message.metadata.model}</div>
          )}
          {message.metadata?.totalTokens && (
            <div>Total tokens: {message.metadata.totalTokens}</div>
          )}
          {message.metadata?.finishReason && (
            <div>Finish reason: {message.metadata.finishReason}</div>
          )}
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
