'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from 'ai';
import type { McpProviderMetadata } from '@ai-sdk/mcp';
export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/chat/mcp/chat' }),
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-2xl stretch">
      {messages.map(m => (
        <div key={m.id} className="mb-4">
          <div className="mb-2 font-semibold">
            {m.role === 'user' ? '👤 User' : '🤖 Assistant'}
          </div>
          <div className="pl-4 space-y-2">
            {m.parts.map((part, index) => {
              // Handle text parts
              if (part.type === 'text') {
                return (
                  <div key={index} className="whitespace-pre-wrap">
                    {part.text}
                  </div>
                );
              }

              if (part.type === 'step-start') {
                return index > 0 ? (
                  <div key={index} className="my-4">
                    <hr className="border-gray-300" />
                  </div>
                ) : null;
              }

              if (isToolUIPart(part)) {
                const toolPart = part as ToolUIPart<any> | DynamicToolUIPart;
                const toolName = getToolName(toolPart);
                const mcpMetadata = toolPart.toolMetadata as
                  | McpProviderMetadata
                  | undefined;
                const mcpTitle = mcpMetadata?.title;
                const mcpClientName = mcpMetadata?.clientName;

                // Display tool title if available, fallback to tool name
                const displayName = mcpTitle || toolPart.title || toolName;

                return (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-300"
                  >
                    <div className="flex gap-2 items-center mb-2">
                      <span className="text-xl">🔧</span>
                      <div>
                        <div className="text-sm font-semibold">
                          {displayName}
                        </div>
                        {displayName !== toolName && (
                          <div className="text-xs text-gray-500">
                            Tool ID: {toolName}
                          </div>
                        )}
                        {mcpClientName && (
                          <div className="text-xs text-gray-500">
                            MCP server: {mcpClientName}
                          </div>
                        )}
                      </div>
                    </div>

                    {toolPart.state === 'input-streaming' && (
                      <div className="text-sm text-gray-600">
                        <div className="mb-1">Streaming input...</div>
                        {toolPart.input && (
                          <pre className="overflow-x-auto p-2 text-xs bg-white rounded">
                            {JSON.stringify(toolPart.input, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {toolPart.state === 'input-available' && (
                      <div className="text-sm text-gray-600">
                        <div className="mb-1">Input:</div>
                        <pre className="overflow-x-auto p-2 text-xs bg-white rounded">
                          {JSON.stringify(toolPart.input, null, 2)}
                        </pre>
                      </div>
                    )}

                    {toolPart.state === 'output-available' && (
                      <div className="text-sm">
                        <div className="mb-1 text-gray-600">Output:</div>
                        <div className="p-2 text-xs bg-white rounded">
                          {typeof toolPart.output === 'string'
                            ? toolPart.output
                            : JSON.stringify(toolPart.output, null, 2)}
                        </div>
                      </div>
                    )}

                    {toolPart.state === 'output-error' && (
                      <div className="text-sm text-red-600">
                        Error: {toolPart.errorText}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      ))}

      {(status === 'submitted' || status === 'streaming') && (
        <div className="mt-4 text-sm text-gray-500">
          {status === 'submitted' && <div>Loading...</div>}
          <button
            type="button"
            className="px-4 py-2 mt-4 text-sm text-blue-500 rounded-md border border-blue-500 hover:bg-blue-50"
            onClick={stop}
          >
            Stop
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <div className="text-sm text-red-500">An error occurred.</div>
          <button
            type="button"
            className="px-4 py-2 mt-4 text-sm text-blue-500 rounded-md border border-blue-500 hover:bg-blue-50"
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
