import { fireworks, type FireworksImageModelOptions } from '@ai-sdk/fireworks';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: fireworks.image('accounts/fireworks/models/flux-1-schnell-fp8'),
    prompt: 'A luminous glass greenhouse floating over a forest at dawn',
    aspectRatio: '16:9',
    seed: 42,
    providerOptions: {
      fireworks: {
        guidance_scale: 4.5,
        num_inference_steps: 8,
      } satisfies FireworksImageModelOptions,
    },
  });

  await presentImages(result.images);
});
