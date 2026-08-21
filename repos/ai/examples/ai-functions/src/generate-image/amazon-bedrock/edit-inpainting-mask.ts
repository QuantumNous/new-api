import { readFileSync } from 'node:fs';
import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const image = readFileSync('data/sunlit_lounge.png');
  const mask = readFileSync('data/sunlit_lounge_mask_white_black.png');

  console.log('INPUT IMAGE:');
  await presentImages([
    {
      uint8Array: new Uint8Array(image),
      base64: '',
      mediaType: 'image/png',
    },
  ]);

  const prompt =
    'A sunlit indoor lounge area with a pool containing a flamingo';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: amazonBedrock.image('amazon.nova-canvas-v1:0'),
    prompt: {
      text: prompt,
      images: [image],
      mask: mask,
    },
    providerOptions: {
      bedrock: {
        quality: 'standard',
        cfgScale: 7.0,
      },
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
