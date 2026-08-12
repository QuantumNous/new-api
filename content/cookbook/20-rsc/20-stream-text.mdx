---
title: Stream Text
description: Learn how to stream text using the AI SDK and React Server Components.
tags: ['rsc', 'streaming']
---

# Stream Text

<Note>
  This example uses React Server Components (RSC). If you want to client side
  rendering and hooks instead, check out the ["stream text" example with
  useCompletion](/examples/next-pages/basics/streaming-text-generation).
</Note>

Text generation can sometimes take a long time to complete, especially when you're generating a couple of paragraphs. In such cases, it is useful to stream the text generation process to the client in real-time. This allows the client to display the generated text as it is being generated, rather than have users wait for it to complete before displaying the result.

<Browser>
  <TextGeneration stream />
</Browser>

## Client

Let's create a simple React component that will call the `generate` function when a button is clicked. The `generate` function will call the `streamText` function, which will then generate text based on the input prompt. To consume the stream of text in the client, we will use the `readStreamableValue` function from the `@ai-sdk/rsc` module.

```tsx filename="app/page.tsx"
'use client';

import { useState } from 'react';
import { generate } from './actions';
import { readStreamableValue } from '@ai-sdk/rsc';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export default function Home() {
  const [generation, setGeneration] = useState<string>('');

  return (
    <div>
      <button
        onClick={async () => {
          const { output } = await generate('Why is the sky blue?');

          for await (const delta of readStreamableValue(output)) {
            setGeneration(currentGeneration => `${currentGeneration}${delta}`);
          }
        }}
      >
        Ask
      </button>

      <div>{generation}</div>
    </div>
  );
}
```

## Server

On the server side, we need to implement the `generate` function, which will call the `streamText` function. The `streamText` function will generate text based on the input prompt. In order to stream the text generation to the client, we will use `createStreamableValue` that can wrap any changeable value and stream it to the client.

Using DevTools, we can see the text generation being streamed to the client in real-time.

```typescript filename='app/actions.ts'
'use server';

import { streamText } from 'ai';
import { createStreamableValue } from '@ai-sdk/rsc';

export async function generate(input: string) {
  const stream = createStreamableValue('');

  (async () => {
    const { textStream } = streamText({
      model: 'openai/gpt-5.4',
      prompt: input,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })();

  return { output: stream.value };
}
```
