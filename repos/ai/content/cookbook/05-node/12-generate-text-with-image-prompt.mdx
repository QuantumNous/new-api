---
title: Generate Text with Image Prompt
description: Learn how to generate text with image prompt using the AI SDK and Node
tags: ['node', 'multimodal']
---

# Generate Text with Image Prompt

Some language models that support vision capabilities accept images as part of the prompt. Here are some of the different [formats](/docs/reference/ai-sdk-core/generate-text#content-image) you can use to include images as input.

## URL

```ts file='index.ts'
import { generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-4.1',
  maxOutputTokens: 512,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'what are the red things in this image?',
        },
        {
          type: 'file',
          mediaType: 'image',
          data: new URL(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/2024_Solar_Eclipse_Prominences.jpg/720px-2024_Solar_Eclipse_Prominences.jpg',
          ),
        },
      ],
    },
  ],
});

console.log(result);
```

## File Buffer

```ts file='index.ts'
import { generateText } from 'ai';
import fs from 'fs';

const result = await generateText({
  model: 'openai/gpt-4.1',
  maxOutputTokens: 512,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'what are the red things in this image?',
        },
        {
          type: 'file',
          mediaType: 'image',
          data: fs.readFileSync('./node/attachments/eclipse.jpg', {
            encoding: 'base64',
          }),
        },
      ],
    },
  ],
});

console.log(result);
```
