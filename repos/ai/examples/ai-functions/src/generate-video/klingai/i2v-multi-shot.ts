import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI multi-shot image-to-video with kling-v3.0-i2v...',
    () =>
      generateVideo({
        model: klingai.video('kling-v3.0-i2v'),
        prompt: {
          image:
            'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
          text: '',
        },
        duration: 8,
        providerOptions: {
          klingai: {
            mode: 'pro',
            multiShot: true,
            shotType: 'customize',
            multiPrompt: [
              {
                index: 1,
                prompt: 'The cat stretches and yawns lazily in the sunlight.',
                duration: '4',
              },
              {
                index: 2,
                prompt: 'The cat pounces playfully on a toy mouse.',
                duration: '4',
              },
            ],
            sound: 'on',
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies KlingAIVideoModelOptions,
        },
      }),
  );

  await presentVideos(videos);
});
