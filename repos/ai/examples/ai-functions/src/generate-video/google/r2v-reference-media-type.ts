import { google, type GoogleVideoModelOptions } from '@ai-sdk/google';
import { experimental_generateVideo as generateVideo } from 'ai';
import fs from 'node:fs';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating reference-to-video with Veo...',
    () =>
      generateVideo({
        model: google.video('veo-3.1-generate-preview'),
        prompt:
          'The two characters meet and walk together through a sunny park',
        inputReferences: [
          {
            data: fs.readFileSync('data/comic-cat.png'),
            mediaType: 'image/png',
          },
          {
            data: fs.readFileSync('data/comic-dog.png'),
            mediaType: 'image/png',
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
