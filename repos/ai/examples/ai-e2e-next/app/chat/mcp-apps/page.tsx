'use client';

import ChatInput from '@/components/chat-input';
import {
  experimental_MCPAppRenderer as MCPAppRenderer,
  useChat,
  type MCPAppBridgeHandlers,
  type MCPAppMetadata,
  type MCPAppRendererProps,
  type MCPAppResource,
  type MCPAppSandboxConfig,
} from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';

const chatTransport = new DefaultChatTransport({ api: '/chat/mcp-apps/chat' });

const mcpAppSandbox = {
  url: '/chat/mcp-apps/sandbox',
  className:
    'block w-full h-80 overflow-hidden rounded-lg border border-blue-200 bg-white',
  style: { border: 0 },
} satisfies MCPAppSandboxConfig;

const mcpAppFallback = (
  <div className="p-3 text-sm text-gray-500">Loading MCP App...</div>
);

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function callMCPAppHost(method: string, params: unknown) {
  return fetchJson('/chat/mcp-apps/host', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
}

function loadMCPAppResource(app: MCPAppMetadata): Promise<MCPAppResource> {
  return callMCPAppHost('mcp-apps/read-resource', { uri: app.resourceUri });
}

const mcpAppHandlers: MCPAppBridgeHandlers = {
  callTool: params => callMCPAppHost('tools/call', params),
  readResource: params => callMCPAppHost('resources/read', params),
  openLink: ({ url }) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    return {};
  },
  onError: error => {
    console.error(error);
  },
};

function MCPAppTool({ part }: { part: MCPAppRendererProps['part'] }) {
  return (
    <MCPAppRenderer
      part={part}
      loadResource={loadMCPAppResource}
      handlers={mcpAppHandlers}
      sandbox={mcpAppSandbox}
      fallback={mcpAppFallback}
    />
  );
}

export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    transport: chatTransport,
  });
  const isBusy = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-2xl stretch">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">MCP Apps chat</h1>
        <p className="mt-2 text-sm text-gray-600">
          Ask for the dashboard. The MCP server advertises an app-backed tool;
          this page renders its UI resource in a sandboxed MCP App frame.
        </p>
      </div>

      {messages.map(m => (
        <div key={m.id} className="mb-4">
          <div className="mb-2 font-semibold">
            {m.role === 'user' ? 'User' : 'Assistant'}
          </div>
          <div className="pl-4 space-y-2">
            {m.parts.map((part, index) => {
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
                return <MCPAppTool key={part.toolCallId} part={part} />;
              }

              return null;
            })}
          </div>
        </div>
      ))}

      {isBusy ? (
        <div className="mt-4 text-sm text-gray-500">
          {status === 'submitted' ? <div>Loading...</div> : null}
          <button
            type="button"
            className="px-4 py-2 mt-4 text-sm text-blue-500 rounded-md border border-blue-500 hover:bg-blue-50"
            onClick={stop}
          >
            Stop
          </button>
        </div>
      ) : null}

      {error ? (
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
      ) : null}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
