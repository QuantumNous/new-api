import { byteDance } from '@ai-sdk/bytedance';
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
        prompt: 'Create a 360-degree orbiting camera shot based on this photo',
        frameImages: [
          {
            image:
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seepro_first_frame.jpeg',
            frameType: 'first_frame',
          },
          {
            image:
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seepro_last_frame.jpeg',
            frameType: 'last_frame',
          },
        ],
        duration: 5,
        providerOptions: {
          bytedance: {
            watermark: false,
            pollTimeoutMs: 600000,
          },
        },
      }),
  );

  await presentVideos([video]);
});
