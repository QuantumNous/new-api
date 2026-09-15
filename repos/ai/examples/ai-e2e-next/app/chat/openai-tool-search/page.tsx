'use client';

import type { OpenAIToolSearchMessage } from '@/agent/openai/tool-search-agent';
import { Response } from '@/components/ai-elements/response';
import ChatInput from '@/components/chat-input';
import OpenAIToolSearchView from '@/components/tool/openai-tool-search-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function TestOpenAIToolSearch() {
  const { error, status, sendMessage, messages, regenerate } =
    useChat<OpenAIToolSearchMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/openai-tool-search',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">
        OpenAI Tool Search (Multi-turn)
      </h1>
      <p className="mb-4 text-sm text-gray-600">
        This example demonstrates OpenAI&apos;s tool search feature with
        deferred loading. Ask about weather, files, or email to see how tools
        are dynamically discovered and loaded.
      </p>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text': {
                return <Response key={index}>{part.text}</Response>;
              }
              case 'tool-toolSearch': {
                return <OpenAIToolSearchView invocation={part} key={index} />;
              }
              case 'tool-get_weather':
              case 'tool-search_files':
              case 'tool-send_email': {
                return (
                  <div
                    key={index}
                    className="mb-2 bg-gray-600 rounded-xl border border-gray-900 shadow-lg"
                  >
                    <pre className="overflow-x-auto p-4 text-sm text-gray-100 whitespace-pre-wrap">
                      <div className="pb-2 font-semibold">
                        Tool call &quot;{part.type.replace('tool-', '')}&quot;
                        {part.providerExecuted ? ' (provider-executed)' : ''}
                      </div>
                      {JSON.stringify(part.input, null, 2)}
                      {part.state === 'output-available' && (
                        <>
                          <div className="pt-2 pb-2 font-semibold">Output:</div>
                          {JSON.stringify(part.output, null, 2)}
                        </>
                      )}
                    </pre>
                  </div>
                );
              }
            }
          })}
        </div>
      ))}

      {error && (
        <div className="mt-4">
          <div className="text-red-500">An error occurred: {error.message}</div>
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
