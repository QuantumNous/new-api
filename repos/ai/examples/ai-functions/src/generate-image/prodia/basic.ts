import { prodia, type ProdiaImageModelOptions } from '@ai-sdk/prodia';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images, providerMetadata } = await generateImage({
    model: prodia.image('inference.flux-fast.schnell.txt2img.v2'),
    prompt:
      'A cat wearing an intricate robe while gesticulating wildly, in the style of 80s pop art',
    providerOptions: {
      prodia: {
        width: 1024,
        height: 1024,
        steps: 4,
      } satisfies ProdiaImageModelOptions,
    },
  });

  await presentImages(images);

  console.log('providerMetadata', JSON.stringify(providerMetadata, null, 2));
});
