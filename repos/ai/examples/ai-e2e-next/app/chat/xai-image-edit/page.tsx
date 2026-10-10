'use client';

/* eslint-disable @next/next/no-img-element */
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRef, useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat/xai-image-edit',
    }),
  });

  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="font-bold">
            {message.role === 'user' ? 'User: ' : 'AI: '}
          </div>
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <div key={index}>{part.text}</div>;
            }
            if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
              return (
                <img
                  key={index}
                  className="rounded-md mt-2 max-w-full"
                  src={part.url}
                  alt="Generated image"
                />
              );
            }
          })}
        </div>
      ))}

      {error && (
        <div className="mt-4">
          <div className="text-red-500">An error occurred.</div>
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 rounded-md border border-blue-500"
            onClick={() => regenerate()}
          >
            Retry
          </button>
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input, files });
          setFiles(undefined);
          setInput('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        className="fixed bottom-0 w-full max-w-md p-2 flex flex-col gap-2"
      >
        <div className="flex flex-row items-end gap-2">
          {files
            ? Array.from(files).map(file =>
                file.type.startsWith('image/') ? (
                  <div key={file.name}>
                    <img
                      className="w-16 rounded-md"
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                    />
                    <span className="text-xs text-zinc-500">{file.name}</span>
                  </div>
                ) : null,
              )
            : null}
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={e => {
            if (e.target.files) {
              setFiles(e.target.files);
            }
          }}
        />
        <input
          value={input}
          placeholder="Describe what to generate or edit..."
          onChange={e => setInput(e.target.value)}
          className="w-full p-2 bg-zinc-100"
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
