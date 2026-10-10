---
title: Stream Text with Image Prompt
description: Learn how to stream text with an image prompt using the AI SDK and Next.js
tags: ['next', 'streaming', 'multimodal']
---

# Stream Text with Image Prompt

Vision models such as GPT-4o can process both text and images. In this example, we will show you how to send an image URL along with the user's message to the model with `useChat`.

## Using Image URLs

### Server

The server route uses `convertToModelMessages` to handle the conversion from `UIMessage`s to model messages, which automatically handles multimodal content including images.

```tsx filename='app/api/chat/route.ts' highlight="16,20-22"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Call the language model
  const result = streamText({
    model: 'openai/gpt-4.1',
    messages: await convertToModelMessages(messages),
  });

  // Respond with the stream
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

### Client

On the client side, we use the new `useChat` hook and send multimodal messages using the `parts` array.

```typescript filename='app/page.tsx'
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export default function Chat() {
  const [input, setInput] = useState('');
  const [imageUrl, setImageUrl] = useState(
    'https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png',
  );

  const { messages, sendMessage } = useChat();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage({
      role: 'user',
      parts: [
        // check if imageUrl is defined, if so, add it to the message
        ...(imageUrl.trim().length > 0
          ? [
              {
                type: 'file' as const,
                mediaType: 'image/png',
                url: imageUrl,
              },
            ]
          : []),
        { type: 'text' as const, text: input },
      ],
    });
    setInput('');
    setImageUrl('');
  };

  return (
    <div>
      <div>
        {messages.map(m => (
          <div key={m.id}>
            <span>{m.role === 'user' ? 'User: ' : 'AI: '}</span>
            <div>
              {m.parts.map((part, i) => {
                switch (part.type) {
                  case 'text':
                    return part.text;
                  case 'file':
                    return (
                      <img
                        key={(part.filename || 'image') + i}
                        src={part.url}
                        alt={part.filename ?? 'image'}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="image-url">Image URL:</label>
          <input
            id="image-url"
            value={imageUrl}
            placeholder="Enter image URL..."
            onChange={e => setImageUrl(e.currentTarget.value)}
          />
        </div>
        <div>
          <label htmlFor="image-description">Prompt:</label>
          <input
            id="image-description"
            value={input}
            placeholder="What does the image show..."
            onChange={e => setInput(e.currentTarget.value)}
          />
        </div>
        <button type="submit">Send Message</button>
      </form>
    </div>
  );
}
```
