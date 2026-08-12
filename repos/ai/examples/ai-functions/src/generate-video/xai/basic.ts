import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { video } = await withSpinner(
    'Generating xAI video with grok-imagine-video...',
    () =>
      generateVideo({
        model: xai.video('grok-imagine-video'),
        prompt: 'A yorkie among dandelions at Crissy Field in San Francisco.',
        aspectRatio: '16:9',
        duration: 5,
        providerOptions: {
          xai: {
            pollTimeoutMs: 600000, // 10 minutes
          } satisfies XaiVideoModelOptions,
        },
      }),
  );

  await presentVideos([video]);
});
