'use client';

import type { AzureImageGenerationMessage } from '@/agent/azure/image-generation-agent';
import ChatInput from '@/components/chat-input';
import ImageGenerationView from '@/components/tool/openai-image-generation-view';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function TestOpenAIImageGeneration() {
  const { status, sendMessage, messages } =
    useChat<AzureImageGenerationMessage>({
      transport: new DefaultChatTransport({
        api: '/api/chat/azure-image-generation',
      }),
    });

  return (
    <div className="flex flex-col py-24 mx-auto w-full max-w-md stretch">
      <h1 className="mb-4 text-xl font-bold">
        Azure OpenAI Image Generation Test
      </h1>

      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <div key={index}>{part.text}</div>;
              case 'tool-image_generation':
                return <ImageGenerationView key={index} invocation={part} />;
            }
          })}
        </div>
      ))}

      <ChatInput status={status} onSubmit={text => sendMessage({ text })} />
    </div>
  );
}
