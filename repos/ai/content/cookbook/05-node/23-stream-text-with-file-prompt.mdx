---
title: Stream Text with File Prompt
description: Learn how to stream text with file prompt using the AI SDK and Node
tags: ['node', 'streaming', 'multimodal']
---

# Stream Text with File Prompt

Working with files in AI applications often requires analyzing documents, processing structured data, or extracting information from various file formats. File prompts allow you to send file content directly to the model, enabling tasks like document analysis, data extraction, or generating responses based on file contents.

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
          {
            type: 'text',
            text: 'What is an embedding model according to this document?',
          },
          {
            type: 'file',
            data: fs.readFileSync('./data/ai.pdf'),
            mediaType: 'application/pdf',
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
