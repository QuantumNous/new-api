import { byteDance, type ByteDanceImageModelOptions } from '@ai-sdk/bytedance';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const prompt =
    'A salamander in a forest pond at dusk surrounded by fireflies.';
  console.log(`PROMPT: ${prompt}`);

  const result = await generateImage({
    model: byteDance.imageModel('seedream-5-0-260128'),
    prompt,
    size: '2048x2048',
    providerOptions: {
      bytedance: {
        watermark: false,
      } satisfies ByteDanceImageModelOptions,
    },
  });

  console.log('OUTPUT IMAGE:');
  await presentImages(result.images);

  console.log('Generated', result.images.length, 'image(s)');
  console.log('Warnings:', JSON.stringify(result.warnings, null, 2));
  console.log(
    'Provider metadata:',
    JSON.stringify(result.providerMetadata, null, 2),
  );
});
