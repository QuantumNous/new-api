import { replicate, type ReplicateVideoModelOptions } from '@ai-sdk/replicate';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: replicate.video('wan-video/wan-2.5-t2v'),
      prompt:
        'A chocolate Devon Rex cat about to pounce on a tribble while Spock watches with curiosity.',
      aspectRatio: '16:9',
      duration: 10,
      providerOptions: {
        replicate: {
          pollTimeoutMs: 600000, // 10 minutes
        } satisfies ReplicateVideoModelOptions,
      },
    }),
  );

  await presentVideos([video]);
});
