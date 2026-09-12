import { replicate, type ReplicateVideoModelOptions } from '@ai-sdk/replicate';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: replicate.video('openai/sora-2'),
      prompt:
        'Green parrots against the San Francisco skyline in a post-apocalyptic future setting at night with neon glowing signs downtown.',
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
