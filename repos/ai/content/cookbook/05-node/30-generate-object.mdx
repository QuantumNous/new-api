---
title: Generate Object
description: Learn how to generate structured data using the AI SDK and Node
tags: ['node', 'structured data']
---

# Generate Object

Earlier functions like `generateText` and `streamText` gave us the ability to generate unstructured text. However, if you want to generate structured data like JSON, you can provide an `Output` that describes the structure of your desired object to `generateText`.

The `Output.object` function requires you to provide a schema using [zod](https://zod.dev), a library for defining schemas for JavaScript objects. By using zod, you can also use it to validate the generated object and ensure that it conforms to the specified structure.

```ts file='index.ts'
import { generateText, Output } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: 'openai/gpt-4.1',
  output: Output.object({
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(
          z.object({
            name: z.string(),
            amount: z.string(),
          }),
        ),
        steps: z.array(z.string()),
      }),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});

console.log(JSON.stringify(result.output.recipe, null, 2));
```
