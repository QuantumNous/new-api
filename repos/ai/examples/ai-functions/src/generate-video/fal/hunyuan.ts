import { fal, type FalVideoModelOptions } from '@ai-sdk/fal';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: fal.video('hunyuan-video'),
      prompt:
        'A raven surveying downtown San Francisco at night with neon lights in the style of ukiyo-e.',
      aspectRatio: '16:9',
      duration: 5,
      providerOptions: {
        fal: {
          pollTimeoutMs: 600000, // 10 minutes
          resolution: '580p',
        } satisfies FalVideoModelOptions,
      },
    }),
  );

  await presentVideos(videos);
});
