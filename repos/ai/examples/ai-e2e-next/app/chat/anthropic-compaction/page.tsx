'use client';

/* eslint-disable @next/next/no-img-element */
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FileIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/anthropic-compaction',
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
  });

  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="p-2 bg-blue-50 border-b border-blue-200">
        <h1 className="text-lg font-bold">Anthropic Compaction Test</h1>
        <p className="text-sm text-zinc-600">
          Context is pre-loaded with a large document corpus (~50k tokens) and 5
          conversation turns. Your messages will be appended to this context.
          Compaction should trigger soon - summaries will be highlighted in
          yellow.
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Try asking: &quot;Summarize the key algorithms and data structures
          from the documentation&quot;
        </p>
      </div>

      <div className="flex flex-col gap-2 p-2 pb-40">
        {messages.map(message => (
          <div key={message.id} className="flex flex-row gap-2">
            <div className="flex-shrink-0 w-24 text-zinc-500">{`${message.role}: `}</div>

            <div className="flex flex-col gap-2">
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  // Check if this is a compaction summary
                  const isCompaction =
                    (
                      part.providerMetadata?.anthropic as
                        | { type?: string }
                        | undefined
                    )?.type === 'compaction';

                  if (isCompaction) {
                    return (
                      <div
                        key={index}
                        className="bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-yellow-700">
                            [COMPACTION SUMMARY]
                          </span>
                          <span className="text-xs text-yellow-600 bg-yellow-200 px-2 py-0.5 rounded">
                            Context was compressed
                          </span>
                        </div>
                        <div className="text-yellow-900 whitespace-pre-wrap">
                          {part.text}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className="whitespace-pre-wrap">
                      {part.text}
                    </div>
                  );
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
                      <span className="text-sm text-zinc-500">
                        {part.filename}
                      </span>
                    </div>
                  );
                }
                if (part.type === 'file') {
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-zinc-100 rounded"
                    >
                      <span className="text-sm text-zinc-600">
                        {part.filename}
                      </span>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ))}

        {status === 'streaming' && (
          <div className="text-zinc-400 text-sm">Streaming...</div>
        )}
      </div>

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
        className="fixed bottom-0 left-0 right-0 flex flex-col w-full gap-2 p-2 bg-white border-t"
      >
        <div className="flex flex-row items-end gap-2 overflow-x-auto pb-2">
          {files
            ? Array.from(files).map(attachment => {
                const { type } = attachment;

                if (type.startsWith('image/')) {
                  return (
                    <div key={attachment.name} className="flex-shrink-0">
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
                } else {
                  return (
                    <div
                      key={attachment.name}
                      className="flex flex-col flex-shrink-0 w-24 gap-1 text-sm text-zinc-500"
                    >
                      <div className="w-16 h-20 rounded-md bg-zinc-100 flex items-center justify-center">
                        <FileIcon className="w-4 h-4 text-zinc-400" />
                      </div>
                      <span className="truncate">{attachment.name}</span>
                    </div>
                  );
                }
              })
            : null}
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            onChange={event => {
              if (event.target.files) {
                setFiles(event.target.files);
              }
            }}
            multiple
            ref={fileInputRef}
            className="text-sm"
          />
        </div>
        <input
          value={input}
          placeholder="Send message..."
          onChange={e => setInput(e.target.value)}
          className="w-full p-2 bg-zinc-100 rounded"
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
