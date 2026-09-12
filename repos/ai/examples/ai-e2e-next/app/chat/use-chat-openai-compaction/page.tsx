'use client';

import type { OpenAICompactionMessage } from '@/agent/openai/compaction-agent';
import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';

export default function Page() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/use-chat-openai-compaction',
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat<OpenAICompactionMessage>({
    transport,
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-2xl stretch">
      <div className="p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h1 className="text-lg font-bold">OpenAI Compaction Test</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Context is pre-loaded with a large document corpus (~50k tokens) and 5
          conversation turns. Your messages will be appended to this context.
          Compaction should trigger soon - a notification will appear when it
          does.
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Try asking: &quot;Summarize the key algorithms and data structures
          from the documentation&quot;
        </p>
      </div>

      <div className="flex flex-col gap-4 pb-40">
        {messages.map(message => (
          <div key={message.id} className="flex flex-col gap-2">
            <div className="font-semibold text-sm text-zinc-500">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>

            {message.parts.map((part, index) => {
              if (part.type === 'custom' && part.kind === 'openai.compaction') {
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg"
                  >
                    <span className="text-amber-600 text-lg">⚡</span>
                    <div>
                      <span className="font-semibold text-amber-700 text-sm">
                        Context Compacted
                      </span>
                      <p className="text-xs text-amber-600 mt-0.5">
                        The server compressed the conversation context to reduce
                        token usage. The encrypted compaction state will be
                        passed forward automatically.
                      </p>
                    </div>
                  </div>
                );
              }

              if (part.type === 'text') {
                return (
                  <div key={index} className="whitespace-pre-wrap">
                    {part.text}
                  </div>
                );
              }
            })}
          </div>
        ))}

        {status === 'streaming' && (
          <div className="text-zinc-400 text-sm animate-pulse">
            Streaming...
          </div>
        )}
      </div>

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
