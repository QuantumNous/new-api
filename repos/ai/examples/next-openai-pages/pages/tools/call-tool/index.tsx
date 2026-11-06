import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isStaticToolUIPart } from 'ai';
import { useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: '/api/call-tool' }),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 p-2">
        {messages.map(message => (
          <div key={message.id} className="flex flex-row gap-2">
            <strong>{`${message.role}: `}</strong>

            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return <div key={index}>{part.text}</div>;
              } else if (isStaticToolUIPart(part)) {
                return <div key={index}>{JSON.stringify(part.input)}</div>;
              }
            })}
          </div>
        ))}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
        className="fixed bottom-0 p-2 w-full"
      >
        <input
          value={input}
          placeholder="Send message..."
          onChange={e => setInput(e.target.value)}
          className="p-2 w-full bg-zinc-100"
        />
      </form>
    </div>
  );
}
