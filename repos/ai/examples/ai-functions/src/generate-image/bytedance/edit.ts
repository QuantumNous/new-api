import { readFileSync } from 'node:fs';
import { byteDance, type ByteDanceImageModelOptions } from '@ai-sdk/bytedance';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateImage({
    model: byteDance.imageModel('seedream-5-0-260128'),
    prompt: {
      text: 'Turn the cat into a snow weasel.',
      images: [readFileSync('data/comic-cat.png')],
    },
    providerOptions: {
      bytedance: {
        watermark: false,
      } satisfies ByteDanceImageModelOptions,
    },
  });

  await presentImages(result.images);

  console.log('Generated', result.images.length, 'image(s)');
  console.log('Warnings:', JSON.stringify(result.warnings, null, 2));
  console.log(
    'Provider metadata:',
    JSON.stringify(result.providerMetadata, null, 2),
  );
});
