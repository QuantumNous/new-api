'use client';

import type { OpenAIApplyPatchMessage } from '@/agent/openai/apply-patch-agent';
import { Response } from '@/components/ai-elements/response';
import ChatInput from '@/components/chat-input';
import { ReasoningView } from '@/components/reasoning-view';
import OpenAIApplyPatchView from '@/components/tool/openai-apply-patch-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function ChatOpenAIApplyPatch() {
  const { error, status, sendMessage, messages, regenerate } =
    useChat<OpenAIApplyPatchMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/openai-apply-patch',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-4xl stretch">
      <h1 className="mb-4 text-2xl font-bold">OpenAI Apply Patch Tool</h1>
      <p className="mb-6 text-gray-600">
        Create, update, and delete files in a workspace using structured diffs.
      </p>

      <div className="space-y-6">
        {messages.map(message => (
          <div key={message.id} className="whitespace-pre-wrap">
            <div className="mb-2 font-semibold">
              {message.role === 'user' ? '👤 User' : '🤖 Assistant'}
            </div>
            <div className="space-y-4 pl-4">
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case 'text': {
                    return <Response key={index}>{part.text}</Response>;
                  }
                  case 'reasoning': {
                    return <ReasoningView part={part} key={index} />;
                  }
                  case 'tool-apply_patch': {
                    return (
                      <OpenAIApplyPatchView invocation={part} key={index} />
                    );
                  }
                }
              })}
            </div>
          </div>
        ))}
      </div>

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

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
