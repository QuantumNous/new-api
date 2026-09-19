import { alibaba, type AlibabaVideoModelOptions } from '@ai-sdk/alibaba';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

const lotionImageUrl =
  'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/r2v_edit_pic1.jpg';
const perfumeVideoUrl =
  'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_video/r2v_edit_video1.mp4';

run(async () => {
  const { video } = await withSpinner(
    'Generating reference-to-video with image and video inputReferences...',
    () =>
      generateVideo({
        model: alibaba.video('wan2.6-r2v'),
        prompt:
          'Replace the perfume in [Video 1] with the lotion from [Image 1].',
        resolution: '1920x1080',
        inputReferences: [
          {
            data: lotionImageUrl,
            mediaType: 'image/png',
          },
          {
            data: perfumeVideoUrl,
            mediaType: 'video/mp4',
          },
        ],
        providerOptions: {
          alibaba: {
            shotType: 'single',
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies AlibabaVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
