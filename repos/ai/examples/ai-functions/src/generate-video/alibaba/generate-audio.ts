import { alibaba, type AlibabaVideoModelOptions } from '@ai-sdk/alibaba';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating image-to-video with audio (wan2.6-i2v-flash)...',
    () =>
      generateVideo({
        model: alibaba.video('wan2.6-i2v-flash'),
        prompt: {
          image:
            'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/comic-cat.png',
          text: 'The cat waves hello and meows happily',
        },
        duration: 5,
        generateAudio: true,
        providerOptions: {
          alibaba: {
            pollTimeoutMs: 600000,
          } satisfies AlibabaVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
