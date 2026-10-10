import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { useSharedChatContext } from './chat-context';

export default function ChatInput() {
  const { chat } = useSharedChatContext();
  const [text, setText] = useState('');
  const { status, stop, sendMessage } = useChat({ chat });

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (text.trim() === '') return;
        sendMessage({ text });
        setText('');
      }}
    >
      <input
        className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
        placeholder="Say something..."
        disabled={status !== 'ready'}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {stop && (status === 'streaming' || status === 'submitted') && (
        <button
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          type="submit"
          onClick={stop}
        >
          Stop
        </button>
      )}
    </form>
  );
}
