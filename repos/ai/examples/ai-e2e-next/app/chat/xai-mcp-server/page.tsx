'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { XaiMcpServerMessage } from '@/agent/xai/mcp-server-agent';

export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } =
    useChat<XaiMcpServerMessage>({
      transport: new DefaultChatTransport({ api: '/api/chat/xai-mcp-server' }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">xAI MCP Server Tool (DeepWiki)</h1>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="font-semibold">
            {message.role === 'user' ? 'User:' : 'AI:'}
          </div>
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            }

            if (part.type === 'tool-mcp_server') {
              if (part.state === 'input-streaming') {
                return (
                  <pre
                    key={index}
                    className="overflow-auto p-2 text-sm bg-gray-100 rounded my-2"
                  >
                    <div className="font-semibold text-blue-600">
                      MCP Server Tool (streaming...)
                    </div>
                    {JSON.stringify(part.input, null, 2)}
                  </pre>
                );
              }
              if (part.state === 'input-available') {
                return (
                  <pre
                    key={index}
                    className="overflow-auto p-2 text-sm bg-yellow-50 rounded my-2"
                  >
                    <div className="font-semibold text-yellow-600">
                      MCP Server Tool (executing...)
                    </div>
                    {JSON.stringify(part.input, null, 2)}
                  </pre>
                );
              }
              if (part.state === 'output-available') {
                return (
                  <pre
                    key={index}
                    className="overflow-auto p-2 text-sm bg-green-50 rounded my-2"
                  >
                    <div className="font-semibold text-green-600">
                      MCP Server Tool Result
                    </div>
                    <div className="text-gray-500 text-xs mb-1">Input:</div>
                    {JSON.stringify(part.input, null, 2)}
                    <div className="text-gray-500 text-xs mt-2 mb-1">
                      Output:
                    </div>
                    {JSON.stringify(part.output, null, 2)}
                  </pre>
                );
              }
              if (part.state === 'output-error') {
                return (
                  <pre
                    key={index}
                    className="overflow-auto p-2 text-sm bg-red-50 rounded my-2"
                  >
                    <div className="font-semibold text-red-600">
                      MCP Server Tool Error
                    </div>
                    {part.errorText}
                  </pre>
                );
              }
            }

            return null;
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
