import { replicate, type ReplicateVideoModelOptions } from '@ai-sdk/replicate';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: replicate.video('google/veo-3-fast'),
      prompt:
        'A battle between Pikachu and Ultraman in San Francisco Bay with Alcatraz in the background with a lighthouse at night.',
      aspectRatio: '16:9',
      duration: 4,
      providerOptions: {
        replicate: {
          pollTimeoutMs: 600000, // 10 minutes
        } satisfies ReplicateVideoModelOptions,
      },
    }),
  );

  await presentVideos([video]);
});
