import {
  googleVertex,
  type GoogleVertexVideoModelOptions,
} from '@ai-sdk/google-vertex';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// Note: Requires GOOGLE_VERTEX_LOCATION to be set to a specific region (e.g., us-central1)
// Veo models are not available in the 'global' region
run(async () => {
  const { video } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: googleVertex.video('veo-3.1-fast-generate-001'),
      prompt: 'A salamander in a forest pond at dusk with luminescent algae.',
      aspectRatio: '16:9',
      resolution: '1920x1080',
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
