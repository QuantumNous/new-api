import { fal, type FalVideoModelOptions } from '@ai-sdk/fal';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: fal.video('luma-dream-machine/ray-2'),
      prompt:
        'An echidna looking out at San Francisco Bay at sunrise from Crissy Field.',
      aspectRatio: '16:9',
      duration: 5,
      providerOptions: {
        fal: {
          pollTimeoutMs: 600000, // 10 minutes
          resolution: '540p',
        } satisfies FalVideoModelOptions,
      },
    }),
  );

  await presentVideos(videos);
});
