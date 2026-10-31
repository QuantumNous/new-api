import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI motion control video (standard mode)...',
    () =>
      generateVideo({
        model: klingai.video('kling-v2.6-motion-control'),
        prompt: {
          image:
            'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
          text: 'The cat waves hello and smiles',
        },
        providerOptions: {
          klingai: {
            // Required: URL to the reference motion video
            videoUrl: 'https://example.com/reference-motion.mp4',
            // Required: whether to match orientation from image or video
            characterOrientation: 'image',
            // Required: 'std' (standard) or 'pro' (professional)
            mode: 'std',
          } satisfies KlingAIVideoModelOptions,
        },
      }),
  );

  await presentVideos(videos);
});
