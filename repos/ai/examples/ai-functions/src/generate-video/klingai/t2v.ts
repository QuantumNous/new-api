import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI text-to-video with kling-v2.6-t2v...',
    () =>
      generateVideo({
        model: klingai.video('kling-v2.6-t2v'),
        prompt: 'A chicken flying into the sunset in the style of 90s anime.',
        aspectRatio: '16:9',
        duration: 5,
        providerOptions: {
          klingai: {
            mode: 'std',
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies KlingAIVideoModelOptions,
        },
      }),
  );

  await presentVideos(videos);
});
