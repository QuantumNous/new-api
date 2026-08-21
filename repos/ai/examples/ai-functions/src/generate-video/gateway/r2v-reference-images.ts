import { experimental_generateVideo as generateVideo, gateway } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating reference-to-video via AI Gateway...',
    () =>
      generateVideo({
        model: gateway.videoModel('bytedance/seedance-v1.0-lite-i2v'),
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
