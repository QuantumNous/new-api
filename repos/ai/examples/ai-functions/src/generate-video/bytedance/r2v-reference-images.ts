import { byteDance } from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating reference-to-video with seedance-1-0-lite...',
    () =>
      generateVideo({
        model: byteDance.video('seedance-1-0-lite-i2v-250428'),
        prompt:
          'The two characters walk together through a vibrant city street at night',
        inputReferences: [
          'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seepro_first_frame.jpeg',
          'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seepro_last_frame.jpeg',
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
