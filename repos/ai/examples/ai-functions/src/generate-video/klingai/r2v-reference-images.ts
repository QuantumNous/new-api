import { klingai } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI reference-to-video from multiple images...',
    () =>
      generateVideo({
        model: klingai.video('kling-v1.6-i2v'),
        prompt:
          'The two characters meet and walk together through a sunny park',
        inputReferences: [
          'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
          'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-dog.png',
        ],
        aspectRatio: '16:9',
        duration: 5,
        providerOptions: {
          klingai: {
            mode: 'std',
            pollTimeoutMs: 600000, // 10 minutes
          },
        },
      }),
  );

  await presentVideos(videos);
});
