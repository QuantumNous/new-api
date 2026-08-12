import { deepInfra } from '@ai-sdk/deepinfra';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: deepInfra.image('black-forest-labs/FLUX-1-schnell'),
    prompt: 'A resplendent quetzal mid flight amidst raindrops',
  });

  await presentImages(result.images);
});
