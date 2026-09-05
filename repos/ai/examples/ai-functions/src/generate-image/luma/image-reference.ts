import { luma, type LumaImageModelOptions } from '@ai-sdk/luma';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: luma.image('photon-flash-1'),
    prompt: {
      text: 'A salamander at dusk in a forest pond, in the style of ukiyo-e',
      images: [
        'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/future-me-8hcBWcZOkbE53q3gshhEm16S87qDpF.jpeg',
      ],
    },
    aspectRatio: '1:1',
    providerOptions: {
      luma: {
        referenceType: 'image',
        images: [{ weight: 0.8 }],
      } satisfies LumaImageModelOptions,
    },
  });

  await presentImages(result.images);
});
