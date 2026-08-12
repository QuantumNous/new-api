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
    'Generating multi-reference image-to-video with seedance-1-0-lite...',
    () =>
      generateVideo({
        model: byteDance.video('seedance-1-0-lite-i2v-250428'),
        prompt:
          'A boy wearing glasses and a blue T-shirt from [Image 1] and a corgi dog from [Image 2], sitting on the lawn from [Image 3], in 3D cartoon style',
        aspectRatio: '16:9',
        duration: 5,
        providerOptions: {
          bytedance: {
            referenceImages: [
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seelite_ref_1.png',
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seelite_ref_2.png',
              'https://ark-doc.tos-ap-southeast-1.bytepluses.com/doc_image/seelite_ref_3.png',
            ],
            watermark: false,
            pollTimeoutMs: 600000,
          } satisfies ByteDanceVideoProviderOptions,
        },
      }),
  );

  await presentVideos([video]);
});
