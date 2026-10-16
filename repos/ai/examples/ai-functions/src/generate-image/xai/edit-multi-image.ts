import { readFileSync } from 'node:fs';
import { xai } from '@ai-sdk/xai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const cat = readFileSync('data/comic-cat.png');
  const dog = readFileSync('data/comic-dog.png');

  console.log('INPUT IMAGES: 2 animal images');

  const prompt =
    'Combine these two animals into a single image, like a group photo, retaining the style and appearance of the original images';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: xai.image('grok-imagine-image'),
    prompt: {
      text: prompt,
      images: [cat, dog],
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
