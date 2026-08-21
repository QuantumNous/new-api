import { xai } from '@ai-sdk/xai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: xai.image('grok-imagine-image-pro'),
    prompt: 'A salamander at dusk in a forest pond surrounded by fireflies.',
  });

  await presentImages([image]);
});
