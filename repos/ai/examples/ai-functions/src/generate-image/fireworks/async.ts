import { fireworks } from '@ai-sdk/fireworks';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: fireworks.image('accounts/fireworks/models/flux-kontext-pro'),
    prompt: 'A burrito launched through a tunnel',
    aspectRatio: '1:1',
  });

  await presentImages(result.images);
});
