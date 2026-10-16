import { readFileSync } from 'node:fs';
import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
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

  const prompt = 'a cute corgi dog in the same style';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: amazonBedrock.image('amazon.nova-canvas-v1:0'),
    prompt: {
      text: prompt,
      images: [imageBuffer],
    },
    providerOptions: {
      bedrock: {
        maskPrompt: 'cat',
        quality: 'standard',
        cfgScale: 7.0,
      },
    },
    seed: 42,
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
