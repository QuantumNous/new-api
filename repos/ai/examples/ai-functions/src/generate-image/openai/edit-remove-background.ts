import { readFileSync } from 'node:fs';
import { openai, type OpenAIImageModelEditOptions } from '@ai-sdk/openai';
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

  console.log('Removing background...');

  const { images } = await generateImage({
    model: openai.image('gpt-image-1.5'),
    prompt: {
      text: 'do not change anything',
      images: [imageBuffer],
    },
    providerOptions: {
      openai: {
        background: 'transparent',
        outputFormat: 'png',
      } satisfies OpenAIImageModelEditOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
