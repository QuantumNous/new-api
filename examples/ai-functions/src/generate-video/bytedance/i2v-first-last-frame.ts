import {
  byteDance,
  type ByteDanceVideoProviderOptions,
} from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating first-and-last frame video with seedance-1-5-pro...',
    () =>
      generateVideo({
        model: byteDance.video('seedance-1-5-pro-251215'),
        prompt: {
          image:
            'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seepro_first_frame.jpeg',
          text: 'Create a 360-degree orbiting camera shot based on this photo',
        },
        duration: 5,
        providerOptions: {
          bytedance: {
            lastFrameImage:
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seepro_last_frame.jpeg',
            generateAudio: true,
            watermark: false,
            pollTimeoutMs: 600000,
          } satisfies ByteDanceVideoProviderOptions,
        },
      }),
  );

  await presentVideos([video]);
});
