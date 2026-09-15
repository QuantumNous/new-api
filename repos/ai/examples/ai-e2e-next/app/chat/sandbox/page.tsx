'use client';

import type { SandboxAgentUIMessage } from '@/agent/openai/sandbox-agent';
import SandboxShellView from '@/components/tool/sandbox-shell-view';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import { useState } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, error, sendMessage, addToolApprovalResponse } =
    useChat<SandboxAgentUIMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/sandbox',
      }),
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });
  if (error) return <div>{error.message}</div>;

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <div className="space-y-4">
        {messages.map(m =>
          m.parts.map((p, i) => {
            switch (p.type) {
              case 'text':
                return (
                  <div key={i} className="whitespace-pre-wrap">
                    <div>
                      <div className="font-bold">{m.role}</div>
                      <p>{p.text}</p>
                    </div>
                  </div>
                );
              case 'tool-shell':
                return (
                  <SandboxShellView
                    key={i}
                    invocation={p}
                    addToolApprovalResponse={addToolApprovalResponse}
                  />
                );
              default:
                return null;
            }
          }),
        )}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput('');
        }}
      >
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={e => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
