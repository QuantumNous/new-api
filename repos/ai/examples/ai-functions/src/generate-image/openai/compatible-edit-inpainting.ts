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
  const image = readFileSync('data/sunlit_lounge.png');
  const mask = readFileSync('data/sunlit_lounge_mask.png');

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
    model: provider.imageModel('gpt-image-1.5'),
    prompt: {
      text: prompt,
      images: [image],
      mask,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
