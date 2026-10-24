'use client';

/* eslint-disable @next/next/no-img-element */
import { useChat } from '@ai-sdk/react';
import { upload } from '@vercel/blob/client';
import type { FileUIPart } from 'ai';
import { useRef, useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();

  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
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
        onSubmit={event => {
          if (isUploading) {
            alert('Please wait for the files to finish uploading.');
            return;
          }

          sendMessage({ text: input, files });
          setInput('');
          setFiles([]);

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        className="fixed bottom-0 flex flex-col w-full gap-2 p-2"
      >
        <div className="fixed flex flex-row items-end gap-2 right-2 bottom-14">
          {Array.from(files)
            .filter(file => file.mediaType?.startsWith('image/'))
            .map(file => (
              <div key={file.url}>
                <img
                  className="w-24 rounded-md"
                  src={file.url}
                  alt={file.filename}
                />
                <span className="text-sm text-zinc-500">{file.filename}</span>
              </div>
            ))}
        </div>
        <input
          type="file"
          onChange={async event => {
            if (event.target.files) {
              setIsUploading(true);

              for (const file of Array.from(event.target.files)) {
                const blob = await upload(file.name, file, {
                  access: 'public',
                  handleUploadUrl: '/api/files',
                });

                setFiles(prevFiles => [
                  ...prevFiles,
                  {
                    type: 'file' as const,
                    filename: file.name,
                    mediaType: blob.contentType ?? '*/*',
                    url: blob.url,
                  },
                ]);
              }

              setIsUploading(false);
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
