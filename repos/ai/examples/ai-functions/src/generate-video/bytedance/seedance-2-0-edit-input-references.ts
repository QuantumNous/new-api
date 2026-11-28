import {
  byteDance,
  type ByteDanceVideoProviderOptions,
} from '@ai-sdk/bytedance';
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
    'Editing video with seedance-2-0 inputReferences...',
    () =>
      generateVideo({
        model: byteDance.video('dreamina-seedance-2-0-260128'),
        prompt:
          'Replace the perfume in [Video 1] with the lotion from [Image 1].',
        aspectRatio: '16:9',
        duration: 12,
        inputReferences: [
          {
            data: lotionImageUrl,
            mediaType: 'image/jpeg',
          },
          {
            data: perfumeVideoUrl,
            mediaType: 'video/mp4',
          },
        ],
        providerOptions: {
          bytedance: {
            generateAudio: true,
            watermark: false,
            pollTimeoutMs: 600000,
          } satisfies ByteDanceVideoProviderOptions,
        },
      }),
  );

  await presentVideos([video]);
});
