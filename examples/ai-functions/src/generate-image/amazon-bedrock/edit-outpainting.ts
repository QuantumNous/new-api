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

  const prompt = 'A beautiful sunset landscape with mountains';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: amazonBedrock.image('amazon.nova-canvas-v1:0'),
    prompt: {
      text: prompt,
      images: [imageBuffer],
    },
    providerOptions: {
      bedrock: {
        taskType: 'OUTPAINTING',
        maskPrompt: 'background',
        outPaintingMode: 'DEFAULT',
        quality: 'standard',
        cfgScale: 7.0,
      },
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
