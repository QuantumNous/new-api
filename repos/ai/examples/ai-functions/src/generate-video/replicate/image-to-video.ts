import { replicate, type ReplicateVideoModelOptions } from '@ai-sdk/replicate';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner('Generating video from image...', () =>
    experimental_generateVideo({
      model: replicate.video('kwaivgi/kling-v2.5-turbo-pro'),
      prompt: {
        image:
          'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
        text: 'The cat slowly turns its head and blinks',
      },
      aspectRatio: '16:9',
      providerOptions: {
        replicate: {
          pollTimeoutMs: 600000, // 10 minutes
        } satisfies ReplicateVideoModelOptions,
      },
    }),
  );

  await presentVideos([video]);
});
