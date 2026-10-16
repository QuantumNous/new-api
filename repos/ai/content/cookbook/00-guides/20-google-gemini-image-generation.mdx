---
title: Google Gemini Image Generation
description: Generate and edit images with Google Gemini 2.5 Flash Image using the AI SDK.
tags: ['image-generation', 'google', 'gemini']
---

# Generate and Edit Images with Google Gemini 2.5 Flash

This guide will show you how to generate and edit images with the AI SDK and Google's latest multimodal language model Gemini 2.5 Flash Image.

## Generating Images

As Gemini 2.5 Flash Image is a language model with multimodal capabilities, you can use the `generateText` or `streamText` functions (not `generateImage`) to create images. The model determines which modality to respond in based on your prompt and configuration. Here's how to create your first image:

```ts
import { generateText } from 'ai';
import fs from 'node:fs';
import 'dotenv/config';

async function generateImage() {
  const result = await generateText({
    model: 'google/gemini-2.5-flash-image',
    prompt:
      'Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme',
  });

  // Save generated images
  for (const file of result.files) {
    if (file.mediaType.startsWith('image/')) {
      const timestamp = Date.now();
      const fileName = `generated-${timestamp}.png`;

      fs.mkdirSync('output', { recursive: true });
      await fs.promises.writeFile(`output/${fileName}`, file.uint8Array);

      console.log(`Generated and saved image: output/${fileName}`);
    }
  }
}

generateImage().catch(console.error);
```

Here are some key points to remember:

- Generated images are returned in the `result.files` array
- Images are returned as `Uint8Array` data
- The model leverages Gemini's world knowledge, so detailed prompts yield better results

## Editing Images

Gemini 2.5 Flash Image excels at editing existing images with natural language instructions. You can add elements, modify styles, or transform images while maintaining their core characteristics:

```ts
import { generateText } from 'ai';
import fs from 'node:fs';
import 'dotenv/config';

async function editImage() {
  const editResult = await generateText({
    model: 'google/gemini-2.5-flash-image',
    prompt: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Add a small wizard hat to this cat. Keep everything else the same.',
          },
          {
            type: 'file',
            // data: DataContent (string | Uint8Array | ArrayBuffer | Buffer) or URL
            data: new URL(
              'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
            ),
            mediaType: 'image/jpeg',
          },
        ],
      },
    ],
  });

  // Save the edited image
  const timestamp = Date.now();
  fs.mkdirSync('output', { recursive: true });

  for (const file of editResult.files) {
    if (file.mediaType.startsWith('image/')) {
      await fs.promises.writeFile(
        `output/edited-${timestamp}.png`,
        file.uint8Array,
      );
      console.log(`Saved edited image: output/edited-${timestamp}.png`);
    }
  }
}

editImage().catch(console.error);
```

## What's Next?

You've learned how to generate new images from text prompts and edit existing images using natural language instructions with Google's Gemini 2.5 Flash Image model.

For more advanced techniques, integration patterns, and practical examples, check out our [Cookbook](/cookbook) where you'll find comprehensive guides for building sophisticated AI-powered applications.
