'use client';

/* eslint-disable @next/next/no-img-element */
import { useChat } from '@ai-sdk/react';
import { useRef, useState } from 'react';

export default function Page() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState('');

  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 p-2">
        {messages.map(message => (
          <div key={message.id} className="flex flex-row gap-2">
            <div className="flex-shrink-0 w-24 text-zinc-500">{`${message.role}: `}</div>

            <div className="flex flex-col gap-2">
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return <div key={index}>{part.text}</div>;
                }
                if (
                  part.type === 'file' &&
                  part.mediaType?.startsWith('image/')
                ) {
                  return (
                    <div key={index}>
                      <img
                        className="rounded-md w-60"
                        src={part.url}
                        alt={part.filename}
                      />
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={async event => {
          event.preventDefault();

          sendMessage({ text: input, files });

          setFiles(undefined);
          setInput('');

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        className="fixed bottom-0 flex flex-col w-full gap-2 p-2"
      >
        <div className="fixed flex flex-row items-end gap-2 right-2 bottom-14">
          {files
            ? Array.from(files).map(attachment => {
                const { type } = attachment;

                if (type.startsWith('image/')) {
                  return (
                    <div key={attachment.name}>
                      <img
                        className="w-24 rounded-md"
                        src={URL.createObjectURL(attachment)}
                        alt={attachment.name}
                      />
                      <span className="text-sm text-zinc-500">
                        {attachment.name}
                      </span>
                    </div>
                  );
                }
              })
            : ''}
        </div>
        <input
          type="file"
          onChange={event => {
            if (event.target.files) {
              setFiles(event.target.files);
            }
          }}
          multiple
          ref={fileInputRef}
        />
        <input
          value={input}
          placeholder="Send message..."
          onChange={e => setInput(e.target.value)}
          className="w-full p-2 bg-zinc-100"
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
