---
title: Stream Object with Image Prompt
description: Learn how to stream structured data with an image prompt using the AI SDK and Node
tags: ['node', 'streaming', 'structured data', 'multimodal']
---

# Stream Object with Image Prompt

Some language models that support vision capabilities accept images as part of the prompt. Here are some of the different [formats](/docs/reference/ai-sdk-core/generate-text#content-image) you can use to include images as input.

## URL

```ts file='index.ts'
import { streamText, Output } from 'ai';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

async function main() {
  const { partialOutputStream } = streamText({
    model: 'openai/gpt-4.1',
    maxOutputTokens: 512,
    output: Output.object({
      schema: z.object({
        stamps: z.array(
          z.object({
            country: z.string(),
            date: z.string(),
          }),
        ),
      }),
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'list all the stamps in these passport pages?',
          },
          {
            type: 'file',
            mediaType: 'image',
            data: new URL(
              'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/WW2_Spanish_official_passport.jpg/1498px-WW2_Spanish_official_passport.jpg',
            ),
          },
        ],
      },
    ],
  });

  for await (const partialObject of partialOutputStream) {
    console.clear();
    console.log(partialObject);
  }
}

main();
```

## File Buffer

```ts file='index.ts'
import { streamText, Output } from 'ai';
import dotenv from 'dotenv';
import { z } from 'zod';
import fs from 'fs';

dotenv.config();

async function main() {
  const { partialOutputStream } = streamText({
    model: 'openai/gpt-4.1',
    maxOutputTokens: 512,
    output: Output.object({
      schema: z.object({
        stamps: z.array(
          z.object({
            country: z.string(),
            date: z.string(),
          }),
        ),
      }),
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'list all the stamps in these passport pages?',
          },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/passport.png', {
              encoding: 'base64',
            }),
          },
        ],
      },
    ],
  });

  for await (const partialObject of partialOutputStream) {
    console.clear();
    console.log(partialObject);
  }
}

main();
```
