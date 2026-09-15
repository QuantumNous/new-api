import { openai } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: openai.image('gpt-image-1.5'),
    prompt: 'A salamander at sunrise in a forest pond in the Seychelles.',
    providerOptions: {
      openai: { quality: 'high' },
    },
  });

  await presentImages([image]);
});
