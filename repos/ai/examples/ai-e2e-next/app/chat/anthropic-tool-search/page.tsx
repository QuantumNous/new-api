'use client';

import type { AnthropicToolSearchAgentMessage } from '@/agent/anthropic/tool-search-agent';
import { Response } from '@/components/ai-elements/response';
import ChatInput from '@/components/chat-input';
import AnthropicToolSearchView from '@/components/tool/anthropic-tool-search-view';
import WeatherView from '@/components/tool/weather-view';
import SendEmailView from '@/components/tool/send-email-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function ChatAnthropicToolSearch() {
  const { error, status, sendMessage, messages, regenerate } =
    useChat<AnthropicToolSearchAgentMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/anthropic-tool-search',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">Anthropic Tool Search</h1>
      <p className="mb-6 text-sm text-gray-600">
        Ask about weather or send emails. Claude will use the tool search to
        discover and load the appropriate tools dynamically.
      </p>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="font-semibold text-gray-500 mb-1">
            {message.role === 'user' ? 'User' : 'AI'}
          </div>
          <div className="flex flex-col gap-2">
            {message.parts.map((part, index) => {
              switch (part.type) {
                case 'text': {
                  return <Response key={index}>{part.text}</Response>;
                }
                case 'tool-toolSearch': {
                  return (
                    <AnthropicToolSearchView invocation={part} key={index} />
                  );
                }
                case 'tool-weather': {
                  return <WeatherView invocation={part} key={index} />;
                }
                case 'tool-send_email': {
                  return <SendEmailView invocation={part} key={index} />;
                }
              }
            })}
          </div>
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
