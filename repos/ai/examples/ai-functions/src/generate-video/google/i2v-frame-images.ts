import { google, type GoogleVideoModelOptions } from '@ai-sdk/google';
import { experimental_generateVideo as generateVideo } from 'ai';
import fs from 'node:fs';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating first-and-last frame video with Veo...',
    () =>
      generateVideo({
        model: google.video('veo-3.1-generate-preview'),
        prompt:
          'The cat walks across the scene and transforms into a dog by the end, in a playful and cartoonish style.',
        frameImages: [
          {
            image: fs.readFileSync('data/comic-cat.png'),
            frameType: 'first_frame',
          },
          {
            image: fs.readFileSync('data/comic-dog.png'),
            frameType: 'last_frame',
          },
        ],
        aspectRatio: '16:9',
        duration: 8,
        providerOptions: {
          google: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies GoogleVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
