import { type GoogleLanguageModelInteractionsOptions } from '@ai-sdk/google';
import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// `gemini-omni-flash-preview` is served by the Interactions API. On Vertex the
// model is currently only available in the `global` region, so pin the location
// explicitly rather than relying on `GOOGLE_VERTEX_LOCATION`. Uses standard
// Google Cloud credentials (not Express Mode API keys).
const vertex = createGoogleVertex({ location: 'global' });

run(async () => {
  const result = await withSpinner('Generating video...', () =>
    generateText({
      model: vertex.interactions('gemini-omni-flash-preview'),
      prompt:
        'A marble rolling fast on a chain reaction style track, continuous smooth shot.',
      providerOptions: {
        google: {
          store: false,
        } satisfies GoogleLanguageModelInteractionsOptions,
      },
    }),
  );

  console.log(result.text);
  console.log();
  console.log(
    'Interaction id:',
    result.finalStep.providerMetadata?.google?.interactionId,
  );
  console.log('Files:', result.files.length);

  const videos = result.files.filter(file =>
    file.mediaType.startsWith('video/'),
  );
  if (videos.length > 0) {
    await presentVideos(videos);
  }
});
