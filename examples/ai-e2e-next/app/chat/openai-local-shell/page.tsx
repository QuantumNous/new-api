'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import ChatInput from '@/components/chat-input';
import type { OpenAILocalShellMessage } from '@/agent/openai/local-shell-agent';
import LocalShellView from '@/components/tool/openai-local-shell-view';

export default function TestOpenAIWebSearch() {
  const { status, sendMessage, messages, addToolApprovalResponse } =
    useChat<OpenAILocalShellMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/openai-local-shell',
      }),
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-2 text-xl font-bold">OpenAI Local Shell Test</h1>
      <h2 className="pb-2 mb-4 border-b">
        Note: This example requires a Vercel OIDC Token to run the Code Shell
        with Vercel Sandbox
      </h2>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          <div className="space-y-4">
            {message.parts.map((part, index) => {
              switch (part.type) {
                case 'text':
                  return <div key={index}>{part.text}</div>;
                case 'tool-shell':
                  return (
                    <LocalShellView
                      key={index}
                      invocation={part}
                      addToolApprovalResponse={addToolApprovalResponse}
                    />
                  );
              }
            })}
          </div>
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
