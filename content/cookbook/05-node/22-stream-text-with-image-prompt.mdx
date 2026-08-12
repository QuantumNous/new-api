---
title: Stream Text with Image Prompt
description: Learn how to stream text with image prompt using the AI SDK and Node
tags: ['node', 'streaming', 'multimodal']
---

# Stream Text with Image Prompt

Vision-language models can analyze images alongside text prompts to generate responses about visual content. This multimodal approach allows for rich interactions where you can ask questions about images, request descriptions, or analyze visual details. The combination of image and text inputs enables more sophisticated AI applications like visual question answering and image analysis.

```ts
import { streamText } from 'ai';
__PROVIDER_IMPORT__;
import 'dotenv/config';
import fs from 'node:fs';

async function main() {
  const result = streamText({
    model: __MODEL__,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/comic-cat.png'),
          },
        ],
      },
    ],
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
}

main().catch(console.error);
```
