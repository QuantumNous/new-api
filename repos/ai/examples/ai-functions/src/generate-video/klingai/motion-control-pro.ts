import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos, providerMetadata } = await withSpinner(
    'Generating KlingAI motion control video (pro mode)...',
    () =>
      generateVideo({
        model: klingai.video('kling-v2.6-motion-control'),
        prompt: {
          image:
            'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
          text: 'The character performs a smooth dance move',
        },
        providerOptions: {
          klingai: {
            // Required: URL to the reference motion video
            videoUrl: 'https://example.com/dance-reference.mp4',
            // Match orientation from the reference video (allows up to 30s)
            characterOrientation: 'video',
            // Pro mode: higher quality output
            mode: 'pro',
            // Keep original audio from the reference video
            keepOriginalSound: 'yes',
            // Enable watermark
            watermarkEnabled: true,
            // Custom polling settings
            pollIntervalMs: 10000, // 10 seconds
            pollTimeoutMs: 600000, // 10 minutes (pro mode takes longer)
          } satisfies KlingAIVideoModelOptions,
        },
      }),
  );

  console.log('Provider metadata:', JSON.stringify(providerMetadata, null, 2));
  await presentVideos(videos);
});
