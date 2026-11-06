import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';
import { convertBase64ToUint8Array } from '../../lib/convert-base64';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-nano'),
    prompt: 'Generate an image of a cat.',
    tools: {
      image_generation: openai.tools.imageGeneration({
        outputFormat: 'webp',
        quality: 'low',
        size: '1024x1024',
      }),
    },
  });

  for (const toolResult of result.staticToolResults) {
    if (toolResult.toolName === 'image_generation') {
      await presentImages([
        {
          mediaType: 'image/webp',
          base64: toolResult.output.result,
          uint8Array: convertBase64ToUint8Array(toolResult.output.result),
        },
      ]);
    }
  }
});
