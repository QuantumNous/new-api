'use client';

import type { AnthropicAdvisor20260301Message } from '@/agent/anthropic/advisor-20260301-agent';
import { Response } from '@/components/ai-elements/response';
import ChatInput from '@/components/chat-input';
import AnthropicAdvisor20260301View from '@/components/tool/anthropic-advisor-20260301-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function TestAnthropicAdvisor20260301() {
  const { error, status, sendMessage, messages, regenerate } =
    useChat<AnthropicAdvisor20260301Message>({
      transport: new DefaultChatTransport({
        api: '/api/chat/anthropic-advisor-20260301',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">Anthropic Advisor (20260301)</h1>

      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text': {
                return <Response key={index}>{part.text}</Response>;
              }
              case 'tool-advisor': {
                return (
                  <AnthropicAdvisor20260301View invocation={part} key={index} />
                );
              }
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
