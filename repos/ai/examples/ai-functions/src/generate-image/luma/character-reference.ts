import { luma, type LumaImageModelOptions } from '@ai-sdk/luma';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: luma.image('photon-flash-1'),
    prompt: {
      text: 'A woman with a cat riding a broomstick in a forest',
      images: [
        'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/future-me-8hcBWcZOkbE53q3gshhEm16S87qDpF.jpeg',
      ],
    },
    aspectRatio: '1:1',
    providerOptions: {
      luma: {
        referenceType: 'character',
        images: [
          {
            id: 'identity0',
          },
        ],
      } satisfies LumaImageModelOptions,
    },
  });

  await presentImages(result.images);
});
