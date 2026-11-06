import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import fs from 'node:fs';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating xAI reference-to-video with explicit mediaType...',
    () =>
      generateVideo({
        model: xai.video('grok-imagine-video'),
        prompt:
          '<IMAGE_1> and <IMAGE_2> ' +
          'are having a playful chase through a sunlit park. ' +
          'Cinematic slow-motion, warm afternoon light.',
        inputReferences: [
          {
            data: fs.readFileSync('data/comic-cat.png'),
            mediaType: 'image/png',
          },
          {
            data: 'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-dog.png',
            mediaType: 'image/png',
          },
        ],
        duration: 8,
        aspectRatio: '16:9',
        providerOptions: {
          xai: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies XaiVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
