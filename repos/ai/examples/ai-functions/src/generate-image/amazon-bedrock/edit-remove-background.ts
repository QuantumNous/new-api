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

  console.log('Removing background...');

  const { images } = await generateImage({
    model: amazonBedrock.image('amazon.nova-canvas-v1:0'),
    prompt: {
      images: [imageBuffer],
    },
    providerOptions: {
      bedrock: {
        taskType: 'BACKGROUND_REMOVAL',
      },
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
