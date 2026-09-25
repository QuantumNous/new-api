import { replicate, type ReplicateVideoModelOptions } from '@ai-sdk/replicate';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: replicate.video('minimax/video-01'),
      prompt: 'A bumblebee on a dandelion in Bali surrounded by pollen dust.',
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
