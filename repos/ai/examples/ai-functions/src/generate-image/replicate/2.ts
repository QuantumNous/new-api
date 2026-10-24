import { replicate } from '@ai-sdk/replicate';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: replicate.image('black-forest-labs/flux-schnell'),
    prompt: 'The Loch Ness Monster getting a manicure',
    aspectRatio: '16:9',
  });

  await presentImages([image]);
});
