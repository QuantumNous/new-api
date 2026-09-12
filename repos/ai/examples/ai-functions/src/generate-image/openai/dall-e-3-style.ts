import { openai, type OpenAIImageModelGenerationOptions } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const { image } = await generateImage({
    model: openai.image('dall-e-3'),
    prompt:
      'A neon-lit cyberpunk alley in Osaka at night, with rain reflections',
    size: '1024x1792',
    providerOptions: {
      openai: {
        style: 'vivid',
        quality: 'hd',
      } satisfies OpenAIImageModelGenerationOptions,
    },
  });

  await presentImages([image]);
});
