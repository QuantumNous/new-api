---
title: Stream Object
description: Learn how to stream structured data using the AI SDK and Node
tags: ['node', 'streaming', 'structured data']
---

# Stream Object

Object generation can sometimes take a long time to complete,
especially when you're generating a large schema.

In Generative UI use cases, it is useful to stream the object to the client in real-time
to render UIs as the object is being generated.
You can use `streamText` with `Output.object` to generate partial object streams.

```ts file='index.ts'
import { streamText, Output } from 'ai';
import { z } from 'zod';

const { partialOutputStream } = streamText({
  model: 'openai/gpt-4.1',
  output: Output.object({
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(z.string()),
        steps: z.array(z.string()),
      }),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});

for await (const partialObject of partialOutputStream) {
  console.clear();
  console.log(partialObject);
}
```
