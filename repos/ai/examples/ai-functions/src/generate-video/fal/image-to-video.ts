import { fal, type FalVideoModelOptions } from '@ai-sdk/fal';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner('Generating video from image...', () =>
    experimental_generateVideo({
      model: fal.video('fal-ai/kling-video/v2.5-turbo/pro/image-to-video'),
      prompt: {
        image:
          'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
        text: 'The cat slowly turns its head and blinks',
      },
      aspectRatio: '16:9',
      providerOptions: {
        fal: {
          pollTimeoutMs: 600000, // 10 minutes
        } satisfies FalVideoModelOptions,
      },
    }),
  );

  await presentVideos(videos);
});
