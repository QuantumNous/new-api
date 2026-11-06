import { useState } from 'react';

export default function ChatInput({
  status,
  onSubmit,
  inputRef,
  stop,
}: {
  status: string;
  onSubmit: (text: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  stop: () => void;
}) {
  const [text, setText] = useState('');

  return (
    <>
      {(status === 'streaming' || status === 'submitted') && (
        <button
          className="fixed bottom-10 p-2 mb-10 w-full max-w-md rounded border border-gray-300 shadow-xl"
          onClick={stop}
        >
          Stop
        </button>
      )}
      <form
        onSubmit={e => {
          e.preventDefault();
          if (text.trim() === '') return;
          onSubmit(text);
          setText('');
        }}
      >
        <input
          ref={inputRef}
          className="fixed bottom-0 p-2 mb-8 w-full max-w-md rounded border border-gray-300 shadow-xl"
          placeholder="Say something..."
          disabled={status !== 'ready'}
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </form>
    </>
  );
}
