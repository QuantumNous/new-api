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
    'Generating text-to-video with seedance-1-0-pro-fast...',
    () =>
      generateVideo({
        model: byteDance.video('seedance-1-0-pro-fast-251015'),
        prompt:
          'A golden retriever puppy running through a sunlit meadow, chasing butterflies, cinematic slow motion',
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
