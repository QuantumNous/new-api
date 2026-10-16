import { readFileSync } from 'node:fs';
import { fal } from '@ai-sdk/fal';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const imageBuffer = readFileSync('data/sunlit_lounge.png');
  const maskBuffer = readFileSync('data/sunlit_lounge_mask_white_black.png');

  console.log('INPUT IMAGE:');
  await presentImages([
    {
      uint8Array: new Uint8Array(imageBuffer),
      base64: '',
      mediaType: 'image/png',
    },
  ]);

  const prompt =
    'A sunlit indoor lounge area with a pool containing a flamingo';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: fal.image('fal-ai/flux-general/inpainting'),
    prompt: {
      text: prompt,
      images: [imageBuffer],
      mask: maskBuffer,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
