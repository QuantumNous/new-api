'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import ChatInput from '@/components/chat-input';
import type { WeatherValibotAgentUIMessage } from '@/agent/anthropic/weather-valibot-agent';
import WeatherValibotView from '@/components/tool/weather-valibot-view';

export default function TestWeatherValibot() {
  const { status, sendMessage, messages } =
    useChat<WeatherValibotAgentUIMessage>({
      transport: new DefaultChatTransport({ api: '/api/chat/weather-valibot' }),
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  console.log(structuredClone(messages));

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">Weather Valibot Test</h1>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <div key={index}>{part.text}</div>;
              case 'tool-weather':
                return <WeatherValibotView key={index} invocation={part} />;
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
