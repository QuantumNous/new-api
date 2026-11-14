import { readFileSync } from 'node:fs';
import {
  togetherai,
  type TogetherAIImageModelOptions,
} from '@ai-sdk/togetherai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const imageBuffer = readFileSync('data/comic-cat.png');

  console.log('INPUT IMAGE:');
  await presentImages([
    {
      uint8Array: new Uint8Array(imageBuffer),
      base64: '',
      mediaType: 'image/png',
    },
  ]);

  const prompt = 'Turn the cat into a golden retriever dog';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: togetherai.image('black-forest-labs/FLUX.1-kontext-pro'),
    prompt: {
      text: prompt,
      images: [imageBuffer],
    },
    size: '1024x1024',
    providerOptions: {
      togetherai: {
        steps: 28,
      } satisfies TogetherAIImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
