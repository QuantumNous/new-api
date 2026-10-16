import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI text-to-video with audio (kling-v2.6-t2v)...',
    () =>
      generateVideo({
        model: klingai.video('kling-v2.6-t2v'),
        prompt:
          'A street musician plays saxophone on a rainy city corner. Background: rain on pavement, distant traffic, saxophone melody.',
        duration: 5,
        generateAudio: true,
        providerOptions: {
          klingai: {
            mode: 'pro',
            pollTimeoutMs: 600000,
          } satisfies KlingAIVideoModelOptions,
        },
      }),
  );

  await presentVideos(videos);
});
