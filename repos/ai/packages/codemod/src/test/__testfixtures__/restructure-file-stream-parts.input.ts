// @ts-nocheck
// Test file for restructure-file-stream-parts codemod

import { streamText } from 'ai';

// Test streamText usage and fullStream iteration
const result = streamText({
  model: openai('gpt-4'),
  prompt: 'Generate a file',
});

for await (const part of result.fullStream) {
  switch (part.type) {
    case 'file':
      // Direct property access that should be restructured
      console.log('Media type:', part.mimeType);
      console.log('Base64:', part.base64);
      console.log('Uint8Array:', part.uint8Array);
      
      // Direct identifier usage in function calls
      processFile(part);
      break;
  }
}

// Test with if statement
for await (const delta of result.fullStream) {
  if (delta.type === 'file') {
    console.log('Base64:', delta.base64);
    uploadFile(delta);
  }
}

// Test object literal that should be restructured
const fileStreamPart = {
  type: 'file',
  mimeType: 'image/png',
  data: new Uint8Array([1, 2, 3]),
  base64: 'AQID',
  uint8Array: new Uint8Array([1, 2, 3])
};

import type { ModelMessage } from 'ai';

export const TEST_PROMPTS: Record<string, ModelMessage> = {
  USER_IMAGE_ATTACHMENT: {
    role: 'user',
    content: [
      {
        type: 'file',
        mediaType: '...',
        data: '...',
      },
      {
        type: 'text',
        text: 'Who painted this?',
      },
    ],
  },
}
