import { readFileSync } from 'node:fs';
import {
  googleVertex,
  type GoogleVertexImageModelOptions,
} from '@ai-sdk/google-vertex';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const image = readFileSync('data/comic-cat.png');
  const mask = readFileSync('data/comic-cat-mask-2.png');

  console.log('INPUT IMAGE:');
  await presentImages([
    {
      uint8Array: new Uint8Array(image),
      base64: '',
      mediaType: 'image/png',
    },
  ]);

  const prompt = 'Extend the scene with more of the forest background';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: googleVertex.image('imagen-3.0-capability-001'),
    prompt: {
      text: prompt,
      images: [image],
      mask,
    },
    providerOptions: {
      vertex: {
        edit: {
          baseSteps: 50,
          mode: 'EDIT_MODE_OUTPAINT',
          maskMode: 'MASK_MODE_USER_PROVIDED',
        },
      } satisfies GoogleVertexImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
