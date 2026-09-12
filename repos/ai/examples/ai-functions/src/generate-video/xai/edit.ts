import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Editing video with xAI grok-imagine-video...',
    () =>
      generateVideo({
        model: xai.video('grok-imagine-video'),
        prompt: 'Render this cat as a dog in the style of 90s anime.',
        providerOptions: {
          xai: {
            mode: 'edit-video',
            videoUrl:
              'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/prudence.mp4',
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies XaiVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
