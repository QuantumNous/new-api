'use client';

import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { ReasoningToolsMessage } from '@/app/api/chat/reasoning-tools/route';

export default function Chat() {
  const { messages, sendMessage, addToolOutput, status } =
    useChat<ReasoningToolsMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/reasoning-tools',
      }),
    });

  console.log(structuredClone(messages));

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages?.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          <strong>{`${message.role}: `}</strong>
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return (
                <pre
                  key={index}
                  className="overflow-x-auto max-w-full whitespace-pre-wrap break-words"
                >
                  {part.text}
                </pre>
              );
            }

            if (part.type === 'reasoning') {
              return (
                <pre
                  key={index}
                  className="overflow-x-auto mb-4 max-w-full italic text-gray-500 whitespace-pre-wrap break-words"
                >
                  {part.text}
                </pre>
              );
            }

            if (part.type === 'tool-web_search') {
              switch (part.state) {
                // example of pre-rendering streaming tool calls:
                case 'input-streaming':
                  return (
                    <pre key={part.toolCallId}>
                      {JSON.stringify(part, null, 2)}
                    </pre>
                  );
                case 'input-available':
                  return (
                    <div key={part.toolCallId} className="text-gray-500">
                      Searching the web...
                    </div>
                  );
                case 'output-available':
                  return (
                    <div key={part.toolCallId} className="text-gray-500">
                      Finished searching the web.
                    </div>
                  );
              }
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
