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
    'Generating audio-video with seedance-1-5-pro...',
    () =>
      generateVideo({
        model: byteDance.video('seedance-1-5-pro-251215'),
        prompt: {
          image:
            'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/i2v_foxrgirl.png',
          text: "A girl holding a fox, the girl opens her eyes, looks gently at the camera, the fox hugs affectionately, the camera slowly pulls out, the girl's hair is blown by the wind, and the sound of the wind can be heard",
        },
        duration: 5,
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
