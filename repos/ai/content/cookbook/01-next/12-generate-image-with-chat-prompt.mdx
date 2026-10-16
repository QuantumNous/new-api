---
title: Generate Image with Chat Prompt
description: Learn how to generate an image with a chat prompt using the AI SDK and Next.js
tags: ['next', 'streaming', 'chat', 'image generation', 'tools']
---

# Generate Image with Chat Prompt

When building a chatbot, you may want to allow the user to generate an image. This can be done by creating a tool that generates an image using the [`generateImage`](/docs/reference/ai-sdk-core/generate-image) function from the AI SDK.

## Server

Let's create an endpoint at `/api/chat` that generates the assistant's response based on the conversation history. You will also define a tool called `generateImage` that will generate an image based on the assistant's response.

```typescript filename='tools/generate-image.ts'
import { generateImage, tool } from 'ai';
import z from 'zod';

export const generateImageTool = tool({
  description: 'Generate an image',
  inputSchema: z.object({
    prompt: z.string().describe('The prompt to generate the image from'),
  }),
  execute: async ({ prompt }) => {
    const { image } = await generateImage({
      model: openai.imageModel('dall-e-3'),
      prompt,
    });
    // in production, save this image to blob storage and return a URL
    return { image: image.base64, prompt };
  },
});
```

```typescript filename='app/api/chat/route.ts'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type InferUITools,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';

import { generateImageTool } from '@/tools/generate-image';

const tools = {
  generateImage: generateImageTool,
};

export type ChatTools = InferUITools<typeof tools>;

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: 'openai/gpt-4o',
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5),
    tools,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

<Note>
  In production, you should save the generated image to a blob storage and
  return a URL instead of the base64 image data. If you don't, the base64 image
  data will be sent to the model which may cause the generation to fail.
</Note>

## Client

Let's create a simple chat interface with `useChat`. You will call the `/api/chat` endpoint to generate the assistant's response. If the assistant's response contains a `generateImage` tool invocation, you will display the tool result (the image in base64 format and the prompt) using the Next `Image` component.

```tsx filename='app/page.tsx'
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Image from 'next/image';
import { type FormEvent, useState } from 'react';
import type { ChatTools } from './api/chat/route';

type ChatMessage = UIMessage<never, never, ChatTools>;

export default function Chat() {
  const [input, setInput] = useState('');

  const { messages, sendMessage } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    sendMessage({
      parts: [{ type: 'text', text: input }],
    });

    setInput('');
  };

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <div className="space-y-4">
        {messages.map(message => (
          <div key={message.id} className="whitespace-pre-wrap">
            <div key={message.id}>
              <div className="font-bold">{message.role}</div>
              {message.parts.map((part, partIndex) => {
                const { type } = part;

                if (type === 'text') {
                  return (
                    <div key={`${message.id}-part-${partIndex}`}>
                      {part.text}
                    </div>
                  );
                }

                if (type === 'tool-generateImage') {
                  const { state, toolCallId } = part;

                  if (state === 'input-available') {
                    return (
                      <div key={`${message.id}-part-${partIndex}`}>
                        Generating image...
                      </div>
                    );
                  }

                  if (state === 'output-available') {
                    const { input, output } = part;

                    return (
                      <Image
                        key={toolCallId}
                        src={`data:image/png;base64,${output.image}`}
                        alt={input.prompt}
                        height={400}
                        width={400}
                      />
                    );
                  }
                }
              })}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
```
