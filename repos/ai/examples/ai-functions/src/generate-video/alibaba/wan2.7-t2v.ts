import { alibaba, type AlibabaVideoModelOptions } from '@ai-sdk/alibaba';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating text-to-video with wan2.7-t2v...',
    () =>
      generateVideo({
        model: alibaba.video('wan2.7-t2v'),
        prompt:
          'A serene mountain lake at sunset. The camera slowly pans across ' +
          'the water, then cuts to a close-up of gentle ripples catching ' +
          'the golden light.',
        resolution: '1920x1080',
        aspectRatio: '16:9',
        duration: 5,
        providerOptions: {
          alibaba: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies AlibabaVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
