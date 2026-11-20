'use client';

import ChatInput from '@/components/chat-input';
import FileSearchView from '@/components/tool/openai-file-search-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { OpenAIFileSearchMessage } from '@/app/api/chat/openai-file-search/route';

export default function TestOpenAIFileSearch() {
  const { status, sendMessage, messages } = useChat<OpenAIFileSearchMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat/openai-file-search',
    }),
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">OpenAI File Search Test</h1>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <div key={index}>{part.text}</div>;
              case 'tool-file_search':
                return <FileSearchView key={index} invocation={part} />;
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
