'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatContainer } from '../../components/chat-container';
import type { CustomDataMessage } from '../types';

const transport = new DefaultChatTransport({
  api: '/api/image-generation',
});

export default function ImageGenerationPage() {
  const { messages, sendMessage, status, error } = useChat<CustomDataMessage>({
    transport,
  });

  return (
    <ChatContainer
      title="Image Generation"
      description={
        <>
          Uses <strong>ChatOpenAI</strong> with the Responses API and{' '}
          <code>tools.imageGeneration()</code> to generate images as multimodal
          output. Ask the AI to create, draw, or visualize anything!
        </>
      }
      messages={messages}
      onSend={text => sendMessage({ text })}
      status={status}
      error={error}
      placeholder="Describe an image you'd like me to create..."
      suggestions={[
        'Draw a cozy coffee shop on a rainy day',
        'Create a futuristic city with flying cars',
        'Generate an abstract painting with vibrant colors',
        'Visualize a peaceful forest with a stream',
      ]}
    />
  );
}
