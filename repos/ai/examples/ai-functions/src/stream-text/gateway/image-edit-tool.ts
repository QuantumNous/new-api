import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { convertBase64ToUint8Array } from '../../lib/convert-base64';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  console.log('Generating base image of an echidna...');
  const baseResult = streamText({
    model: 'openai/gpt-5-nano',
    prompt:
      'Generate an image of an echidna swimming across the Mozambique channel.',
    tools: {
      image_generation: openai.tools.imageGeneration({
        outputFormat: 'webp',
        quality: 'low',
      }),
    },
  });

  let baseImageData: Uint8Array | null = null;

  for await (const part of baseResult.stream) {
    if (part.type == 'tool-result' && !part.dynamic) {
      baseImageData = convertBase64ToUint8Array(part.output.result);
      await presentImages([
        {
          mediaType: 'image/webp',
          base64: part.output.result,
          uint8Array: baseImageData,
        },
      ]);
    }
  }

  if (!baseImageData) {
    throw new Error('No base image generated');
  }

  console.log('Editing image to add vibrant colors...');
  const editResult = streamText({
    model: 'openai/gpt-5-nano',
    prompt: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Make the echidna and water more vibrant with bright blues and purples. Keep the composition the same.',
          },
          {
            type: 'file',
            data: baseImageData,
            mediaType: 'image/webp',
          },
        ],
      },
    ],
    tools: {
      image_generation: openai.tools.imageGeneration({
        outputFormat: 'webp',
        quality: 'low',
      }),
    },
  });

  for await (const part of editResult.stream) {
    if (part.type == 'tool-result' && !part.dynamic) {
      await presentImages([
        {
          mediaType: 'image/webp',
          base64: part.output.result,
          uint8Array: convertBase64ToUint8Array(part.output.result),
        },
      ]);
    }
  }
});
