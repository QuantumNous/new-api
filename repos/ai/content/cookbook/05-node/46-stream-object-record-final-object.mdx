---
title: Record Final Object after Streaming Object
description: Learn how to record the final object after streaming an object using the AI SDK and Node
tags: ['node', 'streaming', 'structured data']
---

# Record Final Object after Streaming Object

When you're streaming structured data, you may want to record the final object for logging or other purposes.

## `onEnd` and `output`

Use `onEnd` for metadata like token usage and await `result.output` for the final structured object.

```ts file='index.ts' highlight={"16-18,24-29"}
import { streamText, Output } from 'ai';
import { z } from 'zod';

const result = streamText({
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
  onEnd({ usage }) {
    console.log('Token usage:', usage);
  },
});

for await (const _ of result.partialOutputStream) {
}

try {
  const output = await result.output;
  console.log('Final object:', JSON.stringify(output, null, 2));
} catch (error) {
  console.error('Failed to parse output:', error);
}
```

## `output` Promise

The `streamText` result contains an `output` promise that resolves to the final object.
The object is fully typed. When the type validation according to the schema fails, the promise will be rejected with a `TypeValidationError`.

```ts file='index.ts' highlight={"21-26"}
import { streamText, Output } from 'ai';
import { z } from 'zod';

const result = streamText({
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

for await (const partialObject of result.partialOutputStream) {
}

try {
  const { recipe } = await result.output;
  console.log('Recipe:', JSON.stringify(recipe, null, 2));
} catch (error) {
  console.error(error);
}
```
