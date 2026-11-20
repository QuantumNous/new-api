---
title: Record Token Usage After Streaming Object
description: Learn how to record token usage when streaming structured data using the AI SDK and Node
tags: ['node', 'streaming', 'structured data', 'observability']
---

# Record Token Usage After Streaming Object

When you're streaming structured data with `streamText` and `Output`,
you may want to record the token usage for billing purposes.

## `onEnd` Callback

You can use the `onEnd` callback to record token usage.
It is called when the stream is finished.

```ts file='index.ts' highlight={"16-18"}
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
```

## `usage` Promise

The `streamText` result contains a `usage` promise that resolves to the total token usage.

```ts file='index.ts' highlight={"28,30"}
import { streamText, Output, LanguageModelUsage } from 'ai';
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

function recordUsage({
  inputTokens,
  outputTokens,
  totalTokens,
}: LanguageModelUsage) {
  console.log('Prompt tokens:', inputTokens);
  console.log('Completion tokens:', outputTokens);
  console.log('Total tokens:', totalTokens);
}

result.usage.then(recordUsage);

recordUsage(await result.usage);

for await (const partialObject of result.partialOutputStream) {
}
```
