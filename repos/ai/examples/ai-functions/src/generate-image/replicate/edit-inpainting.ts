import { readFileSync } from 'node:fs';
import { replicate, type ReplicateImageModelOptions } from '@ai-sdk/replicate';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  // Inpainting example using flux-fill-pro model
  // Note: Flux-2 models (flux-2-pro, flux-2-dev) do not support masks.
  // Use flux-fill-pro or flux-fill-dev for inpainting with masks.
  const image = readFileSync('data/sunlit_lounge.png');
  const mask = readFileSync('data/sunlit_lounge_mask_black_white.png');

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
    model: replicate.image('black-forest-labs/flux-fill-pro'),
    prompt: {
      text: prompt,
      images: [image],
      mask,
    },
    providerOptions: {
      replicate: {
        guidance_scale: 7.5,
        num_inference_steps: 30,
      } satisfies ReplicateImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
