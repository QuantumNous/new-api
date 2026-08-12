import {
  byteDance,
  type ByteDanceVideoProviderOptions,
} from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating text-to-video with seedance-1-0-pro...',
    () =>
      generateVideo({
        model: byteDance.video('seedance-1-0-pro-250528'),
        prompt:
          'Photorealistic style: Under a clear blue sky, a vast expanse of white daisy fields stretches out. The camera gradually zooms in and finally fixates on a close-up of a single daisy, with several glistening dewdrops resting on its petals.',
        aspectRatio: '16:9',
        duration: 5,
        providerOptions: {
          bytedance: {
            watermark: false,
            pollTimeoutMs: 600000,
          } satisfies ByteDanceVideoProviderOptions,
        },
      }),
  );

  await presentVideos([video]);
});
