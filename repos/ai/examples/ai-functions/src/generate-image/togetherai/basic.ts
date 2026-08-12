import {
  togetherai,
  type TogetherAIImageModelOptions,
} from '@ai-sdk/togetherai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: togetherai.image('black-forest-labs/FLUX.2-dev'),
    prompt: 'A delighted resplendent quetzal mid flight amidst raindrops',
    size: '1024x1024',
    providerOptions: {
      togetherai: {
        // Together AI specific options
        steps: 40,
      } satisfies TogetherAIImageModelOptions,
    },
  });

  await presentImages(result.images);
});
