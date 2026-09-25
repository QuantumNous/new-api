import { xai, type XaiImageModelOptions } from '@ai-sdk/xai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: xai.image('grok-imagine-image'),
    prompt: 'A salamander at dusk in a forest pond surrounded by fireflies.',
    providerOptions: {
      xai: {
        resolution: '2k',
      } satisfies XaiImageModelOptions,
    },
  });

  await presentImages([image]);
});
