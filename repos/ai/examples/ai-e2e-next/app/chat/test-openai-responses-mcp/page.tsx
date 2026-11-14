'use client';

import ChatInput from '@/components/chat-input';
import DynamicToolView from '@/components/tool/dynamic-tool-view';
import OpenAIMCPView from '@/components/tool/openai-mcp-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { OpenAIResponsesMCPMessage } from '@/app/api/chat/openai-responses-mcp/route';

export default function TestOpenAIResponsesMCP() {
  const { status, sendMessage, messages } = useChat<OpenAIResponsesMCPMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat/openai-responses-mcp',
    }),
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">OpenAI Responses MCP Tool Test</h1>

      {messages.map(message => (
        <div key={message.id} className="mb-4 whitespace-pre-wrap">
          <div className="mb-2 font-semibold">
            {message.role === 'user' ? 'User' : 'AI'}:
          </div>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return (
                  <div key={index} className="mb-2">
                    {part.text}
                  </div>
                );

              case 'dynamic-tool':
                return (
                  <div key={index} className="mb-4">
                    <DynamicToolView invocation={part} />
                  </div>
                );

              case 'tool-mcp':
                return (
                  <div key={index} className="mb-4">
                    <OpenAIMCPView invocation={part} />
                  </div>
                );

              case 'step-start':
                return index > 0 ? (
                  <div key={index} className="my-2 border-t border-gray-300" />
                ) : null;
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
