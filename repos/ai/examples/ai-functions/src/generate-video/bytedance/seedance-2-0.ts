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
    'Generating text-to-video with seedance-2-0...',
    () =>
      generateVideo({
        model: byteDance.video('dreamina-seedance-2-0-260128'),
        prompt:
          'Photorealistic style: A vibrant street market at golden hour, with warm light filtering through colorful awnings. The camera slowly moves through the crowd, focusing on a flower vendor arranging fresh bouquets.',
        aspectRatio: '16:9',
        duration: 4,
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
