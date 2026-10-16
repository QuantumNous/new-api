import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  console.log('Step 1: generating a source video...');
  const source = await generateVideo({
    model: xai.video('grok-imagine-video'),
    prompt: 'A cat sitting on a windowsill.',
    duration: 3,
    providerOptions: {
      xai: { pollTimeoutMs: 600000 } satisfies XaiVideoModelOptions,
    },
  });

  const sourceUrl = source.providerMetadata?.xai?.videoUrl as
    | string
    | undefined;
  if (sourceUrl == null) {
    throw new Error('xAI provider metadata did not include a source videoUrl.');
  }

  console.log('Source video URL:', sourceUrl);

  console.log('\nStep 2: editing with unsupported params...');
  const result = await generateVideo({
    model: xai.video('grok-imagine-video'),
    prompt: 'Add sunglasses to the cat',
    duration: 10,
    aspectRatio: '16:9',
    resolution: '1280x720',
    providerOptions: {
      xai: {
        videoUrl: sourceUrl,
        pollTimeoutMs: 600000,
      } satisfies XaiVideoModelOptions,
    },
  });

  console.log('\nWarnings:', JSON.stringify(result.warnings, null, 2));
});
