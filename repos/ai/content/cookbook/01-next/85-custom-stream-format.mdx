---
title: Streaming with Custom Format
description: Build a custom format to stream LLM responses
tags: ['next', 'streaming', 'tool use']
---

# Streaming with Custom Format

Create a custom stream to control the streaming format and structure of tool calls instead of using the built-in AI SDK data stream format (`toUIMessageStream()`).

`stream` (on `StreamTextResult`) gives you direct access to all model events. You can transform, filter, and structure these events into your own streaming format. This gives you the benefits of the AI SDK's unified provider interface without prescribing how you consume the stream.

You can:

- Define your own stream chunk format
- Control how steps and tool calls are structured
- Parse the stream manually on the client
- Build custom UI from your stream data

For complete control over both the streaming format and the execution loop, combine this pattern with a [manual agent loop](/cookbook/node/manual-agent-loop).

## Implementation

### Server

Create a route handler that calls a model and then streams the responses in a custom format:

```tsx filename="app/api/stream/route.ts"
import { tools } from '@/ai/tools'; // your tools
import { isStepCount, streamText } from 'ai';
__PROVIDER_IMPORT__;

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: unknown };

const encoder = new TextEncoder();

function formatEvent(event: StreamEvent): Uint8Array {
  return encoder.encode('data: ' + JSON.stringify(event) + '\n\n');
}

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const result = streamText({
    prompt,
    model: __MODEL__,
    tools,
    stopWhen: isStepCount(5),
  });

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      switch (chunk.type) {
        case 'text-delta':
          controller.enqueue(formatEvent({ type: 'text', text: chunk.text }));
          break;
        case 'tool-call':
          controller.enqueue(
            formatEvent({
              type: 'tool-call',
              toolName: chunk.toolName,
              input: chunk.input,
            }),
          );
          break;
        case 'tool-result':
          controller.enqueue(
            formatEvent({
              type: 'tool-result',
              toolName: chunk.toolName,
              result: chunk.output,
            }),
          );
          break;
      }
    },
  });

  return new Response(result.stream.pipeThrough(transformStream), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

The route uses `streamText` to process the prompt with tools. Each event (text, tool calls, tool results) is encoded as a Server-Sent Event with a `data: ` prefix and sent to the client.

### Client

Create a simple interface that parses and displays the stream:

```tsx filename="app/page.tsx"
'use client';

import { useState } from 'react';
import { StreamEvent } from './api/stream/route';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = async () => {
    setEvents([]);
    setIsStreaming(true);
    setPrompt('');

    const response = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const dataStr = line.replace(/^data: /, '');
            const event = JSON.parse(dataStr) as StreamEvent;
            setEvents(prev => [...prev, event]);
          }
        }
      }
    }

    setIsStreaming(false);
  };

  return (
    <div>
      <input
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Enter a prompt..."
      />
      <button onClick={handleSubmit} disabled={isStreaming}>
        {isStreaming ? 'Streaming...' : 'Send'}
      </button>

      <pre>{JSON.stringify(events, null, 2)}</pre>
    </div>
  );
}
```

## How it works

The client uses the Fetch API to stream responses from the server. Since the server sends Server-Sent Events (newline-delimited with `data: ` prefix), the client:

1. Reads chunks from the stream using `getReader()`
2. Decodes the binary chunks to text
3. Splits by newlines to identify complete events
4. Removes the `data: ` prefix and parses the JSON, then appends it to the events list

Events are rendered in order as they arrive, giving you a linear representation of the AI's response.
