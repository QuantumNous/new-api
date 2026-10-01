---
title: Chat with PDFs
description: Learn how to build a chatbot that can understand PDFs using the AI SDK and Next.js
tags: ['next', 'pdf', 'multimodal']
---

# Chat with PDFs

Some language models like Anthropic's Claude Sonnet 3.5 and Google's Gemini 2.0 can understand PDFs and respond to questions about their contents. In this example, we'll show you how to build a chat interface that accepts PDF uploads.

<Note>
  This example requires a provider that supports PDFs, such as Anthropic's
  Claude 3.7, Google's Gemini 2.5, or OpenAI's GPT-4.1. Check the [provider
  documentation](/providers/ai-sdk-providers) for up-to-date support
  information.
</Note>

## Implementation

### Server

Create a route handler that will use Anthropic's Claude model to process messages and PDFs:

```tsx filename="app/api/chat/route.ts"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: 'anthropic/claude-sonnet-4',
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

### Client

Create a chat interface that allows uploading PDFs alongside messages:

```tsx filename="app/page.tsx"
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRef, useState } from 'react';

async function convertFilesToDataURLs(
  files: FileList,
): Promise<
  { type: 'file'; filename: string; mediaType: string; url: string }[]
> {
  return Promise.all(
    Array.from(files).map(
      file =>
        new Promise<{
          type: 'file';
          filename: string;
          mediaType: string;
          url: string;
        }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              type: 'file',
              filename: file.name,
              mediaType: file.type,
              url: reader.result as string, // Data URL
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export default function Chat() {
  const [input, setInput] = useState('');

  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}

          {message.parts.map(part => {
            if (part.type === 'text') {
              return <div key={`${message.id}-text`}>{part.text}</div>;
            }
          })}

          <div></div>
        </div>
      ))}

      <form
        className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl space-y-2"
        onSubmit={async event => {
          event.preventDefault();

          const fileParts =
            files && files.length > 0
              ? await convertFilesToDataURLs(files)
              : [];

          sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: input }, ...fileParts],
          });

          setFiles(undefined);
          setInput('');

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      >
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
          className="w-full p-2"
          value={input}
          placeholder="Say something..."
          onChange={event => {
            setInput(event.target.value);
          }}
        />
      </form>
    </div>
  );
}
```

The code uses the `useChat` hook which handles the file upload and message streaming. The `experimental_attachments` option allows you to send files alongside messages.

Make sure to set up your environment variables with your Anthropic API key:

```env filename=".env.local"
ANTHROPIC_API_KEY=xxxxxxxxx
```

Now you can upload PDFs and ask questions about their contents. The LLM will analyze the PDF and provide relevant responses based on the document's content.
