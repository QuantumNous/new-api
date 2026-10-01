import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// Video extension: continue an existing video from its last frame.
// The `duration` controls the length of the *extension* only, not the total.
// `aspectRatio` and `resolution` are not supported in extension mode — the
// output inherits those from the input video.
run(async () => {
  // Step 1: Generate a short source video.
  const source = await withSpinner('Step 1: Generating source video...', () =>
    generateVideo({
      model: xai.video('grok-imagine-video'),
      prompt: 'A cat sitting on a sunlit windowsill, tail gently swishing.',
      duration: 5,
      aspectRatio: '16:9',
      providerOptions: {
        xai: { pollTimeoutMs: 600000 } satisfies XaiVideoModelOptions,
      },
    }),
  );

  const sourceUrl = source.providerMetadata?.xai?.videoUrl as
    | string
    | undefined;
  if (sourceUrl == null) {
    throw new Error('xAI provider metadata did not include a source videoUrl.');
  }

  console.log('Source video URL:', sourceUrl);
  await presentVideos(source.videos);

  // Step 2: Extend the video with a new scene.
  const extended = await withSpinner(
    'Step 2: Extending video with a new scene...',
    () =>
      generateVideo({
        model: xai.video('grok-imagine-video'),
        prompt:
          'The cat slowly turns its head, notices a butterfly, and leaps off the windowsill.',
        duration: 6,
        providerOptions: {
          xai: {
            mode: 'extend-video',
            videoUrl: sourceUrl,
            pollTimeoutMs: 600000,
          } satisfies XaiVideoModelOptions,
        },
      }),
  );

  console.log('\nExtended video (original 5s + 6s extension = 11s total):');
  console.log(
    'Provider metadata:',
    JSON.stringify(extended.providerMetadata, null, 2),
  );
  await presentVideos(extended.videos);
});
