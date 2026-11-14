'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import ChatInput from '@/components/chat-input';
import type { OpenAIWeatherToolApprovalAgentUIMessage } from '@/agent/openai/weather-tool-approval-agent';
import WeatherWithApprovalView from '@/components/tool/weather-with-approval-view';

export default function TestToolApproval() {
  const { status, sendMessage, messages, addToolApprovalResponse } =
    useChat<OpenAIWeatherToolApprovalAgentUIMessage>({
      transport: new DefaultChatTransport({ api: '/api/chat/tool-approval' }),
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  console.log(structuredClone(messages));

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">Tool Approval Test</h1>

      {messages.map(message => (
        <div key={message.id} className="mb-4 whitespace-pre-wrap">
          <strong>{message.role === 'user' ? 'User: ' : 'AI: '}</strong>

          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <div key={index}>{part.text}</div>;
              case 'tool-weather':
                return (
                  <WeatherWithApprovalView
                    key={index}
                    invocation={part}
                    addToolApprovalResponse={addToolApprovalResponse}
                  />
                );
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
