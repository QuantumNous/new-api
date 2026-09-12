import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// Reference-to-video (R2V): provide reference images to guide the video's
// style and content. The model incorporates the visual elements from those
// images without using them as the first frame (unlike image-to-video).
// Each reference image can be a public HTTPS URL or a base64 data URI.
run(async () => {
  const { video } = await withSpinner(
    'Generating xAI reference-to-video with grok-imagine-video...',
    () =>
      generateVideo({
        model: xai.video('grok-imagine-video'),
        prompt:
          'The comic cat from <IMAGE_1> and the comic dog from <IMAGE_2> ' +
          'are having a playful chase through a sunlit park. ' +
          'Cinematic slow-motion, warm afternoon light.',
        duration: 8,
        aspectRatio: '16:9',
        providerOptions: {
          xai: {
            mode: 'reference-to-video',
            referenceImageUrls: [
              'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
              'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-dog.png',
            ],
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies XaiVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
