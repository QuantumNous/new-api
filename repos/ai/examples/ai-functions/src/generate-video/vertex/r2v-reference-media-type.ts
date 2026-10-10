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
    'Generating reference-to-video with explicit mediaType on Vertex Veo...',
    () =>
      generateVideo({
        model: googleVertex.video('veo-3.1-generate-001'),
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
          vertex: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies GoogleVertexVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
