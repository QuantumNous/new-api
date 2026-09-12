import { xai, type XaiVideoModelOptions } from '@ai-sdk/xai';
import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  // Step 1: Apply first edit
  const step1 = await withSpinner('Step 1: Making cat a princess...', () =>
    generateVideo({
      model: xai.video('grok-imagine-video'),
      prompt: 'Make the cat look like a princess with a small tiara',
      providerOptions: {
        xai: {
          mode: 'edit-video',
          videoUrl:
            'https://raw.githubusercontent.com/vercel/ai/refs/heads/main/examples/ai-functions/data/prudence.mp4',
          pollTimeoutMs: 600000,
        } satisfies XaiVideoModelOptions,
      },
    }),
  );

  console.log('Step 1 done');
  await presentVideos(step1.videos);

  // Use the xAI-hosted URL from step 1 as input for the next two edits
  const step1VideoUrl = step1.providerMetadata?.xai?.videoUrl as
    | string
    | undefined;
  if (step1VideoUrl == null) {
    throw new Error('xAI provider metadata did not include a step-1 videoUrl.');
  }

  // Step 2: Apply two more edits concurrently, building on step 1
  const edits = [
    'Add a sparkly pink collar with a heart-shaped pendant',
    'Surround the cat with floating butterflies and flower petals',
  ];

  const step2Results = await withSpinner(
    `Step 2: Applying ${edits.length} edits concurrently...`,
    () =>
      Promise.all(
        edits.map(prompt =>
          generateVideo({
            model: xai.video('grok-imagine-video'),
            prompt,
            providerOptions: {
              xai: {
                mode: 'edit-video',
                videoUrl: step1VideoUrl,
                pollTimeoutMs: 600000,
              } satisfies XaiVideoModelOptions,
            },
          }),
        ),
      ),
  );

  for (const [i, result] of step2Results.entries()) {
    console.log(`\nStep 2 edit: "${edits[i]}"`);
    await presentVideos(result.videos);
  }
});
