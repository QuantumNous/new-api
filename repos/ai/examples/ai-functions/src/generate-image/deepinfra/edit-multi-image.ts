import { readFileSync } from 'node:fs';
import { deepInfra } from '@ai-sdk/deepinfra';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const cat = readFileSync('data/comic-cat.png');
  const dog = readFileSync('data/comic-dog.png');

  console.log('INPUT IMAGES: cat and dog');

  const prompt =
    'Create a scene with both animals together, a cat and a dog playing as friends';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: deepInfra.image('Qwen/Qwen-Image-Edit'),
    prompt: {
      text: prompt,
      images: [cat, dog],
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
