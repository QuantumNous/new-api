import {
  togetherai,
  type TogetherAIImageModelOptions,
} from '@ai-sdk/togetherai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const prompt = 'Make the background a lush rainforest';
  console.log(`PROMPT: ${prompt}`);

  const { images } = await generateImage({
    model: togetherai.image('black-forest-labs/FLUX.1-kontext-pro'),
    prompt: {
      text: prompt,
      images: ['https://github.com/gr2m.png'],
    },
    size: '1024x1024',
    providerOptions: {
      togetherai: {
        steps: 28,
      } satisfies TogetherAIImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(images);
});
