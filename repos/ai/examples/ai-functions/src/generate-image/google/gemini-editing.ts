import { google } from '@ai-sdk/google';
import { generateImage } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';
import { presentImages } from '../../lib/present-image';

run(async () => {
  console.log('Generating base cat image...');
  const baseResult = await generateImage({
    model: google.image('gemini-2.5-flash-image'),
    prompt:
      'A photorealistic picture of a fluffy ginger cat sitting on a wooden table',
  });

  const timestamp = Date.now();

  fs.mkdirSync('output', { recursive: true });

  const baseImage = baseResult.image;
  await fs.promises.writeFile(
    `output/cat-base-${timestamp}.png`,
    baseImage.uint8Array,
  );
  console.log(`Saved base image: output/cat-base-${timestamp}.png`);

  console.log('Adding wizard hat...');
  const editResult = await generateImage({
    model: google.image('gemini-2.5-flash-image'),
    prompt: {
      text: 'Add a small wizard hat to this cat. Keep everything else the same.',
      images: [baseImage.uint8Array],
    },
  });

  presentImages(editResult.images);
});
