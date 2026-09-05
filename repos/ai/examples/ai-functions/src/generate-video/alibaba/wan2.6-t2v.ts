import { alibaba, type AlibabaVideoModelOptions } from '@ai-sdk/alibaba';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating text-to-video with wan2.6-t2v...',
    () =>
      generateVideo({
        model: alibaba.video('wan2.6-t2v'),
        prompt: 'A chicken flying into the sunset in the style of 90s anime.',
        resolution: '1280x720',
        duration: 5,
        providerOptions: {
          alibaba: {
            promptExtend: true,
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies AlibabaVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
