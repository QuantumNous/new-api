import {
  blackForestLabs,
  type BlackForestLabsImageModelOptions,
} from '@ai-sdk/black-forest-labs';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images, providerMetadata } = await generateImage({
    model: blackForestLabs.image('flux-pro-1.1'),
    prompt:
      'A cat wearing an intricate robe while gesticulating wildly, in the style of 80s pop art',
    aspectRatio: '1:1',
    providerOptions: {
      blackForestLabs: {
        outputFormat: 'png',
      } satisfies BlackForestLabsImageModelOptions,
    },
  });

  await presentImages(images);

  console.log('providerMetadata', JSON.stringify(providerMetadata, null, 2));
});
