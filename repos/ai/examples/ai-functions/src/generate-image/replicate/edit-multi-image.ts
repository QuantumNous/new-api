import { readFileSync } from 'node:fs';
import { replicate, type ReplicateImageModelOptions } from '@ai-sdk/replicate';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  // Flux-2 models support up to 8 reference images for:
  // - Style transfer
  // - Character consistency
  // - Composition guidance
  const cat = readFileSync('data/comic-cat.png');
  const dog = readFileSync('data/comic-dog.png');

  console.log('REFERENCE IMAGES: cat and dog');

  const prompt =
    'Create a scene with both animals together, a cat and a dog playing as friends, in the same comic style as the reference images';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    // Flux-2-pro supports multiple input images via input_image, input_image_2, etc.
    model: replicate.image('black-forest-labs/flux-2-pro'),
    prompt: {
      text: prompt,
      images: [cat, dog],
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
