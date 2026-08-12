import { openai, type OpenAIImageModelGenerationOptions } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: openai.image('gpt-image-2'),
    prompt: 'A red panda barista pouring latte art in a cozy Tokyo cafe',
    providerOptions: {
      openai: {
        outputFormat: 'webp',
        outputCompression: 75,
        moderation: 'low',
      } satisfies OpenAIImageModelGenerationOptions,
    },
  });

  await presentImages([image]);
});
