import { byteDance, type ByteDanceVideoModelOptions } from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating text-to-video with audio (seedance-1-5-pro)...',
    () =>
      generateVideo({
        model: byteDance.video('seedance-1-5-pro-251215'),
        prompt:
          'A jazz trio playing in a cozy club, with ambient crowd noise and clinking glasses.',
        duration: 5,
        generateAudio: true,
        providerOptions: {
          bytedance: {
            watermark: false,
            pollTimeoutMs: 600000,
          } satisfies ByteDanceVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
