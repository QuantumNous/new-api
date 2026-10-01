'use client';

import { Fragment, useState } from 'react';
import type { AI } from './ai';
import { useActions, useAIState, useUIState } from '@ai-sdk/rsc';
import { generateId } from 'ai';
import { Message } from './message';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useUIState<typeof AI>();
  const { submitUserMessage } = useActions<typeof AI>();

  const handleSubmission = async () => {
    setMessages(currentMessages => [
      ...currentMessages,
      {
        id: generateId(),
        display: <Message role="user">{input}</Message>,
      },
    ]);

    const response = await submitUserMessage(input);
    setMessages(currentMessages => [...currentMessages, response]);
    setInput('');
  };

  return (
    <div className="flex flex-col-reverse">
      <div className="flex flex-row gap-2 p-2 bg-zinc-100 w-full">
        <input
          className="bg-zinc-100 w-full p-2 outline-none"
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder="Ask a question"
          onKeyDown={event => {
            if (event.key === 'Enter') {
              handleSubmission();
            }
          }}
        />
        <button
          className="p-2 bg-zinc-900 text-zinc-100 rounded-md"
          onClick={handleSubmission}
        >
          Send
        </button>
      </div>

      <div className="flex flex-col h-[calc(100dvh-56px)] overflow-y-scroll">
        <div>
          {messages.map(message => (
            <Fragment key={message.id}>{message.display}</Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
