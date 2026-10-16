import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI image-to-video with start and end frames...',
    () =>
      generateVideo({
        model: klingai.video('kling-v2.6-i2v'),
        prompt: {
          image:
            'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
          text: 'The cat walks across the scene and transforms into a dog by the end, in a playful and cartoonish style.',
        },
        duration: 5,
        providerOptions: {
          klingai: {
            mode: 'pro',
            // End frame image for start+end frame control
            imageTail:
              'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-dog.png',
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies KlingAIVideoModelOptions,
        },
      }),
  );

  await presentVideos(videos);
});
