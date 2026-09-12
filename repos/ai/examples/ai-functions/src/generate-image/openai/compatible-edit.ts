import { readFileSync } from 'node:fs';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

// Create an OpenAI-compatible provider (using OpenAI's API as an example)
const provider = createOpenAICompatible({
  name: 'openai',
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

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

  const prompt =
    'Turn the cat into a dog but retain the style and dimensions of the original image';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: provider.imageModel('gpt-image-1.5'),
    prompt: {
      text: prompt,
      images: [imageBuffer],
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
