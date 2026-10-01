'use client';

import type { DeepAgentsHarnessAgentMessage } from '@/agent/harness/deepagents/basic-agent';
import { Response } from '@/components/ai-elements/response';
import { useChatId } from '@/components/chat-id-provider';
import ChatInput from '@/components/chat-input';
import DynamicToolView from '@/components/tool/dynamic-tool-view';
import HarnessBashToolView from '@/components/tool/harness-bash-tool-view';
import HarnessFileToolView from '@/components/tool/harness-file-tool-view';
import HarnessToolView from '@/components/tool/harness-tool-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function DeepAgentsHarnessChat({
  apiRoute,
  exampleLabel,
}: {
  apiRoute: string;
  exampleLabel: string;
}) {
  const { chatId, resetChatId } = useChatId();
  const { error, status, sendMessage, messages, regenerate } =
    useChat<DeepAgentsHarnessAgentMessage>({
      id: chatId,
      transport: new DefaultChatTransport({ api: apiRoute }),
    });

  return (
    <div className="flex flex-col pt-12 pb-24 mx-auto w-full max-w-5xl stretch">
      <h1 className="mb-2 text-xl font-bold">Deep Agents — {exampleLabel}</h1>
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
              case 'tool-bash': {
                return <HarnessBashToolView invocation={part} key={index} />;
              }
              case 'tool-read':
              case 'tool-write': {
                return <HarnessFileToolView invocation={part} key={index} />;
              }
              case 'tool-grep': {
                return (
                  <HarnessToolView
                    key={index}
                    toolName="grep"
                    toolArg={
                      typeof part.input === 'object' &&
                      part.input &&
                      'pattern' in part.input
                        ? String(part.input.pattern)
                        : undefined
                    }
                    state={part.state}
                  />
                );
              }
              case 'dynamic-tool': {
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
