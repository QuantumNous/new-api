import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: amazonBedrock.imageModel('amazon.nova-canvas-v1:0'),
    prompt:
      'A salamander at dusk in a forest pond with fireflies in the background, in the style of anime',
    size: '512x512',
    seed: 42,
    providerOptions: {
      bedrock: {
        quality: 'premium',
      },
    },
  });

  await presentImages(result.images);
});
