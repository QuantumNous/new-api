---
title: Generate Text
description: Learn how to generate text using the AI SDK and React Server Components.
tags: ['rsc']
---

# Generate Text

<Note>
  This example uses React Server Components (RSC). If you want to client side
  rendering and hooks instead, check out the ["generate text" example with
  useState](/examples/next-pages/basics/generating-text).
</Note>

A situation may arise when you need to generate text based on a prompt. For example, you may want to generate a response to a question or summarize a body of text. The `generateText` function can be used to generate text based on the input prompt.

<Browser>
  <TextGeneration />
</Browser>

## Client

Let's create a simple React component that will call the `getAnswer` function when a button is clicked. The `getAnswer` function will call the `generateText` function from the `ai` module, which will then generate text based on the input prompt.

```tsx filename="app/page.tsx"
'use client';

import { useState } from 'react';
import { getAnswer } from './actions';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export default function Home() {
  const [generation, setGeneration] = useState<string>('');

  return (
    <div>
      <button
        onClick={async () => {
          const { text } = await getAnswer('Why is the sky blue?');
          setGeneration(text);
        }}
      >
        Answer
      </button>
      <div>{generation}</div>
    </div>
  );
}
```

## Server

On the server side, we need to implement the `getAnswer` function, which will call the `generateText` function from the `ai` module. The `generateText` function will generate text based on the input prompt.

```typescript filename='app/actions.ts'
'use server';

import { generateText } from 'ai';

export async function getAnswer(question: string) {
  const { text, finishReason, usage } = await generateText({
    model: 'openai/gpt-5.4',
    prompt: question,
  });

  return { text, finishReason, usage };
}
```
