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
    'Editing video with seedance-2-0...',
    () =>
      generateVideo({
        model: byteDance.video('dreamina-seedance-2-0-260128'),
        prompt:
          "Replace the cat in [Video 1] with the lion from [Image 1]. The lion lies on its side across the girl's legs, gently interacting with her in a warm and tender way.",
        aspectRatio: '16:9',
        duration: 12,
        providerOptions: {
          bytedance: {
            referenceImages: [
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/r2v_edit_pic1.jpg',
            ],
            referenceVideos: [
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_video/r2v_edit_video1.mp4',
            ],
            generateAudio: true,
            watermark: false,
            pollTimeoutMs: 600000,
          } satisfies ByteDanceVideoProviderOptions,
        },
      }),
  );

  await presentVideos([video]);
});
