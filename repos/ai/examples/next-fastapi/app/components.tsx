import { GeistMono } from 'geist/font/mono';
import Link from 'next/link';
import type { ReactNode } from 'react';

const Code = ({ children }: { children: ReactNode }) => {
  return (
    <code
      className={`${GeistMono.className} text-xs bg-zinc-100 p-1 rounded-md border`}
    >
      {children}
    </code>
  );
};

export const Card = ({ type }: { type: string }) => {
  return type === 'chat-text' ? (
    <div className="self-center w-full fixed bottom-20 px-8 py-6">
      <div className="p-4 border rounded-lg flex flex-col gap-2 w-full">
        <div className="text font-semibold text-zinc-800">
          Stream Chat Completions
        </div>
        <div className="text-zinc-500 text-sm leading-6 flex flex-col gap-4">
          <p>
            The <Code>useChat</Code> hook can be integrated with a Python
            FastAPI backend to stream chat completions in real-time. The most
            basic setup involves streaming plain text chunks by setting the{' '}
            <Code>streamProtocol</Code> to <Code>text</Code>.
          </p>

          <p>
            To make your responses streamable, you will have to use the{' '}
            <Code>StreamingResponse</Code> class provided by FastAPI.
          </p>
        </div>
      </div>
    </div>
  ) : type === 'chat-data' ? (
    <div className="self-center w-full fixed bottom-20 px-8 py-6">
      <div className="p-4 border rounded-lg flex flex-col gap-2 w-full">
        <div className="text font-semibold text-zinc-800">
          Stream Chat Completions with Tools
        </div>
        <div className="text-zinc-500 text-sm leading-6 flex flex-col gap-4">
          <p>
            The <Code>useChat</Code> hook can be integrated with a Python
            FastAPI backend to stream chat completions in real-time. However,
            the most basic setup that involves streaming plain text chunks by
            setting the <Code>streamProtocol</Code> to <Code>text</Code> is
            limited.
          </p>

          <p>
            As a result, setting the streamProtocol to <Code>data</Code> allows
            you to stream chunks that include information about tool calls and
            results.
          </p>

          <p>
            To make your responses streamable, you will have to use the{' '}
            <Code>StreamingResponse</Code> class provided by FastAPI. You will
            also have to ensure that your chunks follow the{' '}
            <Link
              target="_blank"
              className="text-blue-500 hover:underline"
              href="https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-stream-protocol"
            >
              data stream protocol
            </Link>{' '}
            and that the response has <Code>x-vercel-ai-data-stream</Code>{' '}
            header set to <Code>v1</Code>.
          </p>
        </div>
      </div>
    </div>
  ) : type === 'chat-attachments' ? (
    <div className="self-center w-full fixed top-14 px-8 py-6">
      <div className="p-4 border rounded-lg flex flex-col gap-2 w-full">
        <div className="text font-semibold text-zinc-800">
          Stream Chat Completions with Attachments
        </div>
        <div className="text-zinc-500 text-sm leading-6 flex flex-col gap-4">
          <p>
            The <Code>useChat</Code> hook can be integrated with a Python
            FastAPI backend to stream chat completions in real-time. To make
            your responses streamable, you will have to use the{' '}
            <Code>StreamingResponse</Code> class provided by FastAPI.
          </p>

          <p>
            Furthermore, you can send files along with your messages by setting{' '}
            <Code>experimental_attachments</Code> to <Code>true</Code> in{' '}
            <Code>handleSubmit</Code>. This will allow you to use process these
            attachments in your FastAPI backend.
          </p>
        </div>
      </div>
    </div>
  ) : null;
};
