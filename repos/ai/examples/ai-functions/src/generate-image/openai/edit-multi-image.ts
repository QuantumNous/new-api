import { readFileSync } from 'node:fs';
import { openai } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const cat = readFileSync('data/comic-cat.png');
  const dog = readFileSync('data/comic-dog.png');
  const owl = readFileSync('data/comic-owl.png');
  const bear = readFileSync('data/comic-bear.png');

  console.log('INPUT IMAGES: 4 animal images');

  const prompt =
    'Combine these animals into an image containing all 4 of them, like a group photo, retaining the style and dimensions of the original images';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: openai.image('gpt-image-1.5'),
    prompt: {
      text: prompt,
      images: [cat, dog, owl, bear],
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
