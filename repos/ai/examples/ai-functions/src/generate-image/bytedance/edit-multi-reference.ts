import { readFileSync } from 'node:fs';
import { byteDance, type ByteDanceImageModelOptions } from '@ai-sdk/bytedance';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const prompt =
    'Combine the cat from image 1 and the dog from image 2 into a single creative composition';
  console.log(`PROMPT: ${prompt}`);

  const result = await generateImage({
    model: byteDance.imageModel('seedream-5-0-260128'),
    prompt: {
      text: prompt,
      images: [
        readFileSync('data/comic-cat.png'),
        readFileSync('data/comic-dog.png'),
      ],
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
