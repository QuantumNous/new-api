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
    'Generating video with reference audio using seedance-2-0...',
    () =>
      generateVideo({
        model: byteDance.video('dreamina-seedance-2-0-260128'),
        prompt:
          'Use the first-person POV framing from [Video 1] throughout, and use [Audio 1] as the background music throughout. First-person POV fruit tea promotional ad, opening frame is [Image 1], your hand picks a dew-covered red apple with a light crisp tapping sound. The fruit tea from [Image 2] is raised toward the camera at the end.',
        aspectRatio: '16:9',
        duration: 8,
        providerOptions: {
          bytedance: {
            referenceImages: [
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/r2v_tea_pic1.jpg',
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/r2v_tea_pic2.jpg',
            ],
            referenceVideos: [
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_video/r2v_tea_video1.mp4',
            ],
            referenceAudio: [
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_audio/r2v_tea_audio1.mp3',
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
