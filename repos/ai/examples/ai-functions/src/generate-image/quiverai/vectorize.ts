import { quiverai, type QuiverAIImageModelOptions } from '@ai-sdk/quiverai';
import { generateImage } from 'ai';
import fs from 'node:fs/promises';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { images } = await generateImage({
    model: quiverai.image('arrow-1.1'),
    prompt: {
      images: [await fs.readFile('data/wtf-logo.png')],
    },
    providerOptions: {
      quiverai: {
        operation: 'vectorize',
        autoCrop: true,
        targetSize: 1024,
      } satisfies QuiverAIImageModelOptions,
    },
  });

  await presentImages(images);
});
