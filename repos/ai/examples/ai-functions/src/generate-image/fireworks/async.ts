import { fireworks, type FireworksImageModelOptions } from '@ai-sdk/fireworks';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: fireworks.image('accounts/fireworks/models/flux-kontext-pro'),
    prompt: 'A burrito launched through a tunnel',
    aspectRatio: '1:1',
    providerOptions: {
      fireworks: {
        output_format: 'png',
        prompt_upsampling: true,
        safety_tolerance: 2,
      } satisfies FireworksImageModelOptions,
    },
  });

  await presentImages(result.images);
});
