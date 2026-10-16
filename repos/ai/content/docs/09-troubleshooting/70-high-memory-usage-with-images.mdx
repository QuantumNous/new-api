---
title: High memory usage when processing many images
description: Troubleshooting high memory usage when using generateText or streamText with many images
---

# High memory usage when processing many images

## Issue

When using `generateText` or `streamText` with many images (e.g., in a loop or batch processing), you may notice:

- Memory usage grows continuously and doesn't decrease
- Application eventually runs out of memory
- Memory is not reclaimed even after garbage collection

This is especially noticeable when using `experimental_download` to process images from URLs, or when sending base64-encoded images in prompts.

## Background

By default, the AI SDK includes the full request messages plus request and response bodies in the step results. When processing images, the request messages and request body can contain base64-encoded image data, which can be very large (a single image can be 1MB+ when base64 encoded). If you process many images and keep references to the results, this data accumulates in memory.

For example, processing 100 images of 500KB each would include ~50MB+ of request body data in memory.

## Solution

Use the `include` option to disable inclusion of request messages and/or request and response bodies:

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image' },
        { type: 'file', mediaType: 'image', data: imageUrl },
      ],
    },
  ],
  // Request and response bodies are excluded by default.
  include: {
    requestBody: false,
    responseBody: false,
  },
});
```

### Options

The `include` option accepts:

- `requestBody`: Set to `true` to include the request body in step results. The request body is where base64-encoded images are often stored. Default: `false`. Available in both `generateText` and `streamText`.
- `requestMessages`: Set to `true` to include the request messages in step results. The request messages can contain large message content such as images and files. Default: `false`. Available in both `generateText` and `streamText`.
- `rawChunks`: Set to `true` to include raw provider chunks in the stream. Default: `false`. Only available in `streamText`.
- `responseBody`: Set to `true` to include the response body in step results. Default: `false`. Only available in `generateText`.

### When to use

- **Batch processing images**: When processing many images in a loop
- **Long-running agents**: When an agent may process many images over its lifetime
- **Memory-constrained environments**: When running in environments with limited memory

### Trade-offs

When you disable body inclusion:

- You won't have access to `result.request.body` or `result.response.body`
- You won't have access to `result.request.messages` unless `requestMessages` is enabled
- Debugging may be harder since you can't inspect the raw request/response
- If you need the bodies for logging or debugging, consider extracting the data you need before the next iteration

## Example: Processing multiple images

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const imageUrls = [
  /* array of image URLs */
];
const results = [];

for (const imageUrl of imageUrls) {
  const result = await generateText({
    model: openai('gpt-4o'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image' },
          { type: 'file', mediaType: 'image', data: imageUrl },
        ],
      },
    ],
    include: {
      requestBody: false,
    },
  });

  // Only store the text result, not the full result object
  results.push(result.text);
}
```

## Learn more

- [`generateText` API Reference](/docs/reference/ai-sdk-core/generate-text)
- [`streamText` API Reference](/docs/reference/ai-sdk-core/stream-text)
