import {
  googleVertex,
  type GoogleVertexVideoProviderOptions,
} from '@ai-sdk/google-vertex';
import { experimental_generateVideo } from 'ai';
import fs from 'node:fs';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating video from image (base64)...',
    () =>
      experimental_generateVideo({
        model: googleVertex.video('veo-3.1-generate-001'),
        prompt: {
          image: fs.readFileSync('data/comic-cat.png'),
          text: 'Animate this image with gentle motion',
        },
        aspectRatio: '16:9',
        duration: 4,
        providerOptions: {
          vertex: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies GoogleVertexVideoProviderOptions,
        },
      }),
  );

  await presentVideos([video]);
});
