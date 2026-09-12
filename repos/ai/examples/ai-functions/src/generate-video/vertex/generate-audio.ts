import {
  googleVertex,
  type GoogleVertexVideoModelOptions,
} from '@ai-sdk/google-vertex';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// Note: Requires GOOGLE_VERTEX_LOCATION to be set to a specific region (e.g., us-central1)
// Veo models are not available in the 'global' region
run(async () => {
  const { video } = await withSpinner(
    'Generating Veo video with audio...',
    () =>
      generateVideo({
        model: googleVertex.video('veo-3.1-fast-generate-001'),
        prompt:
          'Ocean waves crashing on a rocky shore at sunset, with seagulls calling overhead.',
        aspectRatio: '16:9',
        resolution: '1920x1080',
        duration: 8,
        generateAudio: true,
        providerOptions: {
          vertex: {
            pollTimeoutMs: 600000,
          } satisfies GoogleVertexVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
