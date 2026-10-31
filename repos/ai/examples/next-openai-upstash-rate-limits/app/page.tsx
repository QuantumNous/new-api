'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat({
    onError: err => toast.error(err.message),
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      {messages.length > 0
        ? messages.map(m => (
            <div key={m.id} className="whitespace-pre-wrap">
              {m.role === 'user' ? 'User: ' : 'AI: '}
              {m.parts
                .map(part => (part.type === 'text' ? part.text : ''))
                .join('')}
            </div>
          ))
        : null}

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
      >
        <input
          className="fixed bottom-0 p-2 mb-8 w-full max-w-md rounded border border-gray-300 shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={e => setInput(e.target.value)}
        />
      </form>
    </div>
  );
}
