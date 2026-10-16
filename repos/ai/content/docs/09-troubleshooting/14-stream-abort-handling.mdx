---
title: onEnd not called when stream is aborted
description: Troubleshooting onEnd callback not executing when streams are aborted with toUIMessageStream
---

# onEnd not called when stream is aborted

## Issue

When using `toUIMessageStream` with an `onEnd` callback, the callback may not execute when the stream is aborted. This happens because the abort handler immediately terminates the response, preventing the `onEnd` callback from being triggered.

```tsx
// Server-side code where onEnd isn't called on abort
export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: __MODEL__,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onEnd: async ({ isAborted }) => {
        // This isn't called when the stream is aborted!
        if (isAborted) {
          console.log('Stream was aborted');
          // Handle abort-specific cleanup
        } else {
          console.log('Stream completed normally');
          // Handle normal completion
        }
      },
    }),
  });
}
```

## Background

When a stream is aborted, the response is immediately terminated. Without proper handling, the `onEnd` callback has no chance to execute, preventing important cleanup operations like saving partial results or logging abort events.

## Solution

Add `consumeSseStream: consumeStream` to the `createUIMessageStreamResponse` configuration. This ensures that abort events are properly captured and forwarded to the `onEnd` callback, allowing it to execute even when the stream is aborted.

```tsx
// other imports...
import {
  consumeStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: __MODEL__,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onEnd: async ({ isAborted }) => {
        // Now this WILL be called even when aborted!
        if (isAborted) {
          console.log('Stream was aborted');
          // Handle abort-specific cleanup
        } else {
          console.log('Stream completed normally');
          // Handle normal completion
        }
      },
    }),
    consumeSseStream: consumeStream, // This enables onEnd to be called on abort
  });
}
```
