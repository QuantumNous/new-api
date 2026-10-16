import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';
import { presentVideos } from '../../lib/present-video';

run(async () => {
  const result = await withSpinner('Generating xAI video...', () =>
    generateVideo({
      model: xai.video('grok-imagine-video'),
      prompt: 'A cat sitting on a windowsill watching rain.',
      duration: 5,
      providerOptions: {
        xai: {
          pollTimeoutMs: 600000,
        } satisfies XaiVideoModelOptions,
      },
    }),
  );

  await presentVideos(result.videos);

  console.log(
    'Provider metadata:',
    JSON.stringify(result.providerMetadata, null, 2),
  );
});
