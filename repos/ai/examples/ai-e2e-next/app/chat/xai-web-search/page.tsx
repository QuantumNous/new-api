'use client';

import type { XaiWebSearchMessage } from '@/agent/xai/web-search-agent';
import { Response } from '@/components/ai-elements/response';
import ChatInput from '@/components/chat-input';
import SourcesView from '@/components/sources-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function ChatXaiWebSearch() {
  const { error, status, sendMessage, messages, regenerate } =
    useChat<XaiWebSearchMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/xai-web-search',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">xAI Web Search (Agentic)</h1>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="font-bold">
            {message.role === 'user' ? 'User: ' : 'AI: '}
          </div>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text': {
                return <Response key={index}>{part.text}</Response>;
              }
              case 'tool-web_search': {
                return (
                  <div key={index} className="text-sm text-gray-500 italic">
                    [Searching web...]
                  </div>
                );
              }
              case 'tool-x_search': {
                return (
                  <div key={index} className="text-sm text-gray-500 italic">
                    [Searching X...]
                  </div>
                );
              }
            }
          })}

          <SourcesView
            sources={message.parts.filter(part => part.type === 'source-url')}
          />
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
