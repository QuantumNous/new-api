'use client';

import { useChat } from '@ai-sdk/react';
import { useSharedChatContext } from './chat-context';
import ChatInput from './chat-input';

export default function Chat() {
  const { chat, clearChat } = useSharedChatContext();
  const { messages } = useChat({
    chat,
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <button
        onClick={clearChat}
        disabled={messages.length === 0}
        className="mb-4 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Clear Chat
      </button>

      {messages?.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          <strong>{`${message.role}: `}</strong>
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return (
                <div
                  key={index}
                  className="overflow-x-auto max-w-full whitespace-pre-wrap break-words"
                >
                  {part.text}
                </div>
              );
            }
          })}
        </div>
      ))}

      <ChatInput />
    </div>
  );
}
