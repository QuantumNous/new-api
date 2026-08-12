import { readFileSync } from 'node:fs';
import { deepInfra } from '@ai-sdk/deepinfra';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const imageBuffer = readFileSync('data/comic-cat.png');

  console.log('INPUT IMAGE:');
  await presentImages([
    {
      uint8Array: new Uint8Array(imageBuffer),
      base64: '',
      mediaType: 'image/png',
    },
  ]);

  const prompt = 'Turn the cat into a golden retriever dog';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: deepInfra.image('Qwen/Qwen-Image-Edit'),
    prompt: {
      text: prompt,
      images: [imageBuffer],
    },
    size: '1024x1024',
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
