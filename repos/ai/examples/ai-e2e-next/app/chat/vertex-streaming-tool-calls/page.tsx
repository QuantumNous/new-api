'use client';

import { useChat } from '@ai-sdk/react';
import ChatInput from '@/components/chat-input';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type { VertexStreamingToolCallsMessage } from '@/app/api/chat/vertex-streaming-tool-calls/route';

export default function Chat() {
  const { messages, status, sendMessage, addToolOutput } =
    useChat<VertexStreamingToolCallsMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/vertex-streaming-tool-calls',
      }),

      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

      async onToolCall({ toolCall }) {
        if (toolCall.toolName === 'showWeatherInformation') {
          addToolOutput({
            tool: 'showWeatherInformation',
            toolCallId: toolCall.toolCallId,
            output: 'Weather information displayed to user.',
          });
        }
      },
    });

  let lastRole: string | undefined = undefined;

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="text-lg font-bold mb-4">
        Vertex AI — Streaming Tool Call Arguments
      </h1>

      {messages?.map(m => {
        const isNewRole = m.role !== lastRole;
        lastRole = m.role;

        return (
          <div key={m.id} className="whitespace-pre-wrap mb-2">
            {isNewRole && (
              <strong className="block mb-1">{`${m.role}: `}</strong>
            )}
            {m.parts.map((part, i) => {
              if (part.type === 'text') {
                return <span key={i}>{part.text}</span>;
              }

              if (part.type === 'tool-showWeatherInformation') {
                if (part.state === 'input-streaming') {
                  return (
                    <div
                      key={i}
                      className="p-3 my-2 rounded border border-blue-300 bg-blue-50"
                    >
                      <div className="text-xs font-mono text-blue-600 mb-1">
                        streaming tool args…
                      </div>
                      <pre className="text-sm">
                        {JSON.stringify(part.input, null, 2)}
                      </pre>
                    </div>
                  );
                }

                if (part.state === 'input-available') {
                  return (
                    <div
                      key={i}
                      className="p-3 my-2 rounded border border-yellow-300 bg-yellow-50"
                    >
                      <div className="text-xs text-yellow-700 mb-1">
                        tool call complete — awaiting result
                      </div>
                      <pre className="text-sm">
                        {JSON.stringify(part.input, null, 2)}
                      </pre>
                    </div>
                  );
                }

                if (part.state === 'output-available') {
                  return (
                    <div
                      key={i}
                      className="p-4 my-2 rounded border border-green-300 bg-green-50"
                    >
                      <h4 className="font-semibold mb-1">{part.input.city}</h4>
                      <div className="flex gap-3 text-sm">
                        <span>🌡 {part.input.temperature}°C</span>
                        <span>☁ {part.input.weather}</span>
                      </div>
                      {part.input.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {part.input.description}
                        </p>
                      )}
                    </div>
                  );
                }
              }

              return null;
            })}
          </div>
        );
      })}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
