import { readFileSync } from 'node:fs';
import { fireworks, type FireworksImageModelOptions } from '@ai-sdk/fireworks';
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

  const prompt = 'Transform this into a watercolor painting style';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: fireworks.image('accounts/fireworks/models/flux-kontext-pro'),
    prompt: {
      text: prompt,
      images: [imageBuffer],
    },
    aspectRatio: '1:1',
    providerOptions: {
      fireworks: {
        output_format: 'jpeg',
        safety_tolerance: 2,
      } satisfies FireworksImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
