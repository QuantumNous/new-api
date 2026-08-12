import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner(
    'Generating KlingAI multi-shot text-to-video with kling-v3.0-t2v...',
    () =>
      generateVideo({
        model: klingai.video('kling-v3.0-t2v'),
        prompt: '',
        aspectRatio: '16:9',
        duration: 10,
        providerOptions: {
          klingai: {
            mode: 'pro',
            multiShot: true,
            shotType: 'customize',
            multiPrompt: [
              {
                index: 1,
                prompt:
                  'A sunrise over a calm ocean, warm golden light reflecting on the water.',
                duration: '4',
              },
              {
                index: 2,
                prompt:
                  'A flock of seagulls take flight from the beach, wings spread wide.',
                duration: '3',
              },
              {
                index: 3,
                prompt:
                  'Waves crash against rocky cliffs at sunset, mist rising.',
                duration: '3',
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
