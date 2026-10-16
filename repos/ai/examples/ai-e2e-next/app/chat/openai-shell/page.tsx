'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import ChatInput from '@/components/chat-input';
import type { OpenAIShellMessage } from '@/agent/openai/shell-agent';
import ShellView from '@/components/tool/openai-shell-view';

export default function ChatOpenAIShell() {
  const { status, sendMessage, messages, addToolApprovalResponse } =
    useChat<OpenAIShellMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/openai-shell',
      }),
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-4xl stretch">
      <h1 className="mb-2 text-xl font-bold text-black">OpenAI Shell Tool</h1>
      <h2 className="pb-2 mb-4 border-b text-black">
        Note: This example requires a Vercel OIDC Token to run commands with
        Vercel Sandbox
      </h2>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap mb-4">
          <div className="mb-2">
            <div className="text-sm font-semibold text-black mb-1">
              {message.role === 'user' ? 'User:' : 'Assistant:'}
            </div>
            <div className="space-y-4">
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case 'text':
                    return (
                      <div key={index} className="text-black">
                        {part.text}
                      </div>
                    );
                  case 'tool-shell':
                    return (
                      <ShellView
                        key={index}
                        invocation={part}
                        addToolApprovalResponse={addToolApprovalResponse}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
