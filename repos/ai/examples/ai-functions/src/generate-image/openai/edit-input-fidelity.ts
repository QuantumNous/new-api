import { readFileSync } from 'node:fs';
import { openai, type OpenAIImageModelEditOptions } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const imageBuffer = readFileSync('data/comic-cat.png');

  const { images } = await generateImage({
    model: openai.image('gpt-image-1'),
    prompt: {
      text: 'Add a tiny pirate hat on the cat, keep everything else identical',
      images: [imageBuffer],
    },
    providerOptions: {
      openai: {
        inputFidelity: 'high',
        outputFormat: 'webp',
        outputCompression: 90,
      } satisfies OpenAIImageModelEditOptions,
    },
  });

  await presentImages(images);
});
