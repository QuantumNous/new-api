'use client';

import type { PiHarnessAgentMessage } from '@/agent/harness/pi/basic-agent';
import { Response } from '@/components/ai-elements/response';
import { useChatId } from '@/components/chat-id-provider';
import ChatInput from '@/components/chat-input';
import DynamicToolView from '@/components/tool/dynamic-tool-view';
import HarnessBashToolView from '@/components/tool/harness-bash-tool-view';
import HarnessFileToolView from '@/components/tool/harness-file-tool-view';
import HarnessToolView from '@/components/tool/harness-tool-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function PiHarnessChat({
  apiRoute,
  exampleLabel,
}: {
  apiRoute: string;
  exampleLabel: string;
}) {
  const { chatId, resetChatId } = useChatId();
  const { error, status, sendMessage, messages, regenerate } =
    useChat<PiHarnessAgentMessage>({
      id: chatId,
      transport: new DefaultChatTransport({
        api: apiRoute,
      }),
    });

  return (
    <div className="flex flex-col pt-12 pb-24 mx-auto w-full max-w-5xl stretch">
      <h1 className="mb-2 text-xl font-bold">Pi — {exampleLabel}</h1>
      <p className="mb-4 text-xs text-gray-500">
        chat id: <code>{chatId}</code>
        <button type="button" className="ml-2 underline" onClick={resetChatId}>
          new session
        </button>
      </p>

      {messages.map(message => (
        <div key={message.id} className="mb-3">
          <strong>{message.role === 'user' ? 'You: ' : 'AI: '}</strong>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text': {
                return (
                  <Response key={index} className="mb-2">
                    {part.text}
                  </Response>
                );
              }
              case 'reasoning': {
                return (
                  <Response
                    key={index}
                    className="italic text-gray-500 whitespace-pre-wrap mb-2"
                  >
                    {part.text}
                  </Response>
                );
              }
              case 'file':
              case 'reasoning-file': {
                if (part.mediaType.startsWith('image/')) {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={index}
                      src={part.url}
                      alt="Generated image"
                      className="mb-2"
                    />
                  );
                }
                return null;
              }
              case 'tool-bash': {
                return <HarnessBashToolView invocation={part} key={index} />;
              }
              case 'tool-read':
              case 'tool-write':
              case 'tool-edit': {
                return <HarnessFileToolView key={index} invocation={part} />;
              }
              case 'tool-glob':
              case 'tool-grep':
              case 'tool-ls': {
                return (
                  <HarnessToolView
                    key={index}
                    toolName={part.type.replace(/^tool-/, '')}
                    toolArg={
                      typeof part.input === 'object' && part.input != null
                        ? ((part.input as { pattern?: string; path?: string })
                            .pattern ??
                          (part.input as { pattern?: string; path?: string })
                            .path ??
                          '')
                        : ''
                    }
                    state={part.state}
                    output={
                      part.state === 'output-available'
                        ? part.output
                        : undefined
                    }
                  />
                );
              }
              case 'dynamic-tool': {
                // Pi already emits Write tool calls, so we don't need to surface these dynamic fileChange events, which effectively show the same thing.
                if (part.toolName === 'fileChange') {
                  return null;
                }
                return <DynamicToolView invocation={part} key={index} />;
              }
            }
          })}
        </div>
      ))}

      {status === 'submitted' && (
        <div
          aria-label="Loading"
          className="w-4 h-4 mb-3 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin"
        />
      )}

      {error && (
        <div className="mt-4">
          <div className="text-red-500 whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </div>
          <button
            type="button"
            className="px-4 py-2 mt-4 text-blue-500 rounded-md border border-blue-500"
            onClick={() => regenerate()}
          >
            Retry
          </button>
        </div>
      )}

      <div
        aria-hidden
        className="fixed inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none"
      />

      <ChatInput
        status={status}
        maxWidth="5xl"
        onSubmit={text => sendMessage({ text })}
      />
    </div>
  );
}
