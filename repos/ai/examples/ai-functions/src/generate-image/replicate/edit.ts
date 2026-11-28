import { readFileSync } from 'node:fs';
import { replicate, type ReplicateImageModelOptions } from '@ai-sdk/replicate';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  // Flux-2 models support up to 8 reference images for style transfer,
  // character consistency, and composition guidance
  const referenceImage = readFileSync('data/comic-cat.png');

  console.log('REFERENCE IMAGE:');
  await presentImages([
    {
      uint8Array: new Uint8Array(referenceImage),
      base64: '',
      mediaType: 'image/png',
    },
  ]);

  const prompt = 'Picture of a dog in the same style as the reference image';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: replicate.image('black-forest-labs/flux-2-pro'),
    prompt: {
      text: prompt,
      images: [referenceImage],
    },
    providerOptions: {
      replicate: {
        output_format: 'png',
      } satisfies ReplicateImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
