import { klingai } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI image-to-video with first and last frames...',
    () =>
      generateVideo({
        model: klingai.video('kling-v2.6-i2v'),
        prompt:
          'The cat walks across the scene and transforms into a dog by the end, in a playful and cartoonish style.',
        frameImages: [
          {
            image:
              'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
            frameType: 'first_frame',
          },
          {
            image:
              'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-dog.png',
            frameType: 'last_frame',
          },
        ],
        duration: 5,
        providerOptions: {
          klingai: {
            mode: 'pro',
            pollTimeoutMs: 600000, // 10 minutes
          },
        },
      }),
  );

  await presentVideos(videos);
});
