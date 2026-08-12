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
    'Extending video with seedance-2-0...',
    () =>
      generateVideo({
        model: byteDance.video('dreamina-seedance-2-0-260128'),
        prompt:
          'The arched window in [Video 1] opens, and the camera moves into the interior of the art museum, transitioning into [Video 2]. After that, the camera enters the painting itself, transitioning into [Video 3].',
        aspectRatio: '16:9',
        duration: 8,
        providerOptions: {
          bytedance: {
            referenceVideos: [
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_video/r2v_extend_video1.mp4',
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_video/r2v_extend_video2.mp4',
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_video/r2v_extend_video3.mp4',
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
