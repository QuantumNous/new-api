import {
  googleVertex,
  type GoogleVertexVideoModelOptions,
} from '@ai-sdk/google-vertex';
import { experimental_generateVideo as generateVideo } from 'ai';
import fs from 'node:fs';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// Note: Requires GOOGLE_VERTEX_LOCATION to be set to a specific region (e.g., us-central1)
// Veo models are not available in the 'global' region
run(async () => {
  const { video } = await withSpinner(
    'Generating first-and-last frame video with Vertex Veo...',
    () =>
      generateVideo({
        model: googleVertex.video('veo-3.1-generate-001'),
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
          vertex: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies GoogleVertexVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
