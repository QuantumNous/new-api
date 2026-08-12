'use client';

import type { AnthropicMicrosoftMessage } from '@/agent/anthropic/microsoft-agent';
import { Response } from '@/components/ai-elements/response';
import ChatInput from '@/components/chat-input';
import { ReasoningView } from '@/components/reasoning-view';
import SourcesView from '@/components/sources-view';
import AnthropicCodeExecutionView from '@/components/tool/anthropic-code-execution-view';
import AnthropicWebFetchView from '@/components/tool/anthropic-web-fetch-view';
import AnthropicWebSearchView from '@/components/tool/anthropic-web-search-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function TestAnthropicWebFetch() {
  const { error, status, sendMessage, messages, regenerate } =
    useChat<AnthropicMicrosoftMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/anthropic-microsoft',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">Microsoft Foundry Anthropic</h1>
      <h2 className="mb-4 text-xl font-bold">
        web search , web fetch , code execution
      </h2>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text': {
                return <Response key={index}>{part.text}</Response>;
              }
              case 'reasoning': {
                return <ReasoningView part={part} key={index} />;
              }
              case 'tool-web_fetch': {
                return <AnthropicWebFetchView invocation={part} key={index} />;
              }
              case 'tool-web_search': {
                return <AnthropicWebSearchView invocation={part} key={index} />;
              }
              case 'tool-code_execution': {
                return (
                  <AnthropicCodeExecutionView
                    provider="anthropic-microsoft"
                    invocation={part}
                    key={index}
                  />
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
