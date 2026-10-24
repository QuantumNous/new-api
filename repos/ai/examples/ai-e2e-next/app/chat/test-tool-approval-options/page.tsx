'use client';

import ChatInput from '@/components/chat-input';
import DynamicToolWithApprovalView from '@/components/tool/dynamic-tool-with-approval-view';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ChatRequestOptions,
} from 'ai';
import { useState } from 'react';

export default function TestToolApprovalOptions() {
  const [systemInstruction, setSystemInstruction] = useState('');

  const requestOptions: ChatRequestOptions = {
    body: { systemInstruction: systemInstruction || undefined },
  };

  const { status, sendMessage, messages, addToolApprovalResponse } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat/tool-approval-options',
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">
        Tool Approval with Options Test
      </h1>

      <label className="mb-4">
        <span className="block mb-1 text-sm font-medium">
          System Instruction (optional):
        </span>
        <input
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="e.g. Always respond in French."
          value={systemInstruction}
          onChange={e => setSystemInstruction(e.target.value)}
        />
      </label>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <div key={index}>{part.text}</div>;
              case 'dynamic-tool':
                return (
                  <DynamicToolWithApprovalView
                    key={index}
                    invocation={part}
                    addToolApprovalResponse={addToolApprovalResponse}
                    requestOptions={requestOptions}
                  />
                );
            }
          })}
        </div>
      ))}

      <ChatInput
        status={status}
        onSubmit={text => sendMessage({ text }, requestOptions)}
      />
    </div>
  );
}
