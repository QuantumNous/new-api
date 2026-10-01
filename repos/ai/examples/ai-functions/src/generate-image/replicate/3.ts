import { replicate, type ReplicateImageModelOptions } from '@ai-sdk/replicate';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: replicate.image('recraft-ai/recraft-v3'),
    prompt: 'The Loch Ness Monster getting a manicure',
    size: '1365x1024',
    providerOptions: {
      replicate: {
        style: 'realistic_image',
      } satisfies ReplicateImageModelOptions,
    },
  });

  await presentImages([image]);
});
