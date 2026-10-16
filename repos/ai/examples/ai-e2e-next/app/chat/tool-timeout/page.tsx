'use client';

import { useState } from 'react';
import ChatInput from '@/components/chat-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { ToolTimeoutMessage } from '@/app/api/chat/tool-timeout/route';

function ErrorDetails({
  errorText,
  toolName,
  query,
  timeoutMs,
}: {
  errorText: string;
  toolName: string;
  query: string;
  timeoutMs: number;
}) {
  const [open, setOpen] = useState(false);
  const timestamp = new Date().toISOString();

  return (
    <div className="flex flex-col my-1 text-sm rounded-lg border border-red-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-red-50">
        <div className="flex items-center gap-2 text-red-700">
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          Tool execution timed out
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
        >
          <svg
            aria-hidden="true"
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
          {open ? 'hide' : 'logs'}
        </button>
      </div>
      {open && (
        <div className="px-3 py-3 bg-gray-950 text-gray-300 font-mono text-xs leading-relaxed">
          <div className="text-gray-500">{timestamp}</div>
          <div className="mt-1">
            <span className="text-blue-400">tool</span>
            <span className="text-gray-500">.</span>
            <span className="text-yellow-300">{toolName}</span>
            <span className="text-gray-500">(</span>
            <span className="text-green-400">&quot;{query}&quot;</span>
            <span className="text-gray-500">)</span>
          </div>
          <div className="mt-1 text-gray-500">timeout: {timeoutMs}ms</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-red-400">ERR</span>
            <span className="text-red-300">{errorText}</span>
          </div>
          <div className="mt-1 text-gray-500">
            Tool aborted - error sent to model as context
          </div>
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const { messages, status, sendMessage } = useChat<ToolTimeoutMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat/tool-timeout' }),
  });

  return (
    <div className="flex flex-col gap-4 p-8 mx-auto max-w-md min-h-screen">
      <h1 className="text-2xl font-semibold tracking-tight">
        Tool Timeout Demo
      </h1>
      <p className="text-sm text-gray-500">
        Tools abort after 1 second. Try &quot;what is the weather in
        tokyo&quot;.
      </p>

      <div className="flex-1 flex flex-col gap-3 pb-20">
        {messages?.map(m => (
          <div
            key={m.id}
            className={`flex flex-col gap-1 ${
              m.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <span className="text-xs font-medium text-gray-400 uppercase">
              {m.role}
            </span>
            <div
              className={`rounded-lg px-4 py-3 max-w-[80%] ${
                m.role === 'user'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {m.parts.map((part, index) => {
                switch (part.type) {
                  case 'text':
                    return (
                      <span key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    );

                  case 'step-start':
                    return index > 0 ? (
                      <hr key={index} className="my-2 border-gray-300" />
                    ) : null;

                  case 'tool-getWeather': {
                    switch (part.state) {
                      case 'input-streaming':
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 px-3 py-2 my-1 text-sm text-gray-500 bg-white border border-gray-200 rounded-md"
                          >
                            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                            Getting weather...
                          </div>
                        );
                      case 'input-available':
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 px-3 py-2 my-1 text-sm text-gray-500 bg-white border border-gray-200 rounded-md"
                          >
                            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                            Getting weather for {part.input.city}...
                          </div>
                        );
                      case 'output-available':
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 px-3 py-2 my-1 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md"
                          >
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                            Result: {JSON.stringify(part.output)}
                          </div>
                        );
                      case 'output-error':
                        return (
                          <ErrorDetails
                            key={index}
                            errorText={part.errorText}
                            toolName="getWeather"
                            query={part.input?.city ?? 'unknown'}
                            timeoutMs={1000}
                          />
                        );
                    }
                    break;
                  }
                }
              })}
            </div>
          </div>
        ))}
      </div>

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
