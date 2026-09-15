import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import fs from 'node:fs';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating xAI image-to-video from base64...',
    () =>
      generateVideo({
        model: xai.video('grok-imagine-video'),
        prompt: {
          image: fs.readFileSync('data/comic-cat.png'),
          text: 'The cat slowly turns its head and blinks',
        },
        duration: 5,
        providerOptions: {
          xai: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies XaiVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
