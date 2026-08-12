import {
  amazonBedrock,
  type AmazonBedrockImageModelOptions,
} from '@ai-sdk/amazon-bedrock';
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
      amazonBedrock: {
        quality: 'premium',
        negativeText: 'blurry, low quality',
        cfgScale: 7.5,
        style: 'PHOTOREALISM',
      } satisfies AmazonBedrockImageModelOptions,
    },
  });

  await presentImages(result.images);
});
