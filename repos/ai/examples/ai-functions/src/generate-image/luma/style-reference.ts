import { luma, type LumaImageModelOptions } from '@ai-sdk/luma';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: luma.image('photon-flash-1'),
    prompt: 'A blue cream Persian cat launching its website on Vercel',
    aspectRatio: '1:1',
    providerOptions: {
      luma: {
        referenceType: 'style',
        images: [{ weight: 0.8 }],
      } satisfies LumaImageModelOptions,
    },
  });

  await presentImages(result.images);
});
