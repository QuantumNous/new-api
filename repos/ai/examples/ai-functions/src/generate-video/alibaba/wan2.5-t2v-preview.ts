import { alibaba, type AlibabaVideoModelOptions } from '@ai-sdk/alibaba';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating text-to-video with wan2.5-t2v-preview...',
    () =>
      generateVideo({
        model: alibaba.video('wan2.5-t2v-preview'),
        prompt:
          'A bustling night market with colorful lanterns, steam rising from food stalls, and people walking through the crowd.',
        resolution: '1920x1080',
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
