import { type GoogleLanguageModelInteractionsOptions } from '@ai-sdk/google';
import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { streamText, type GeneratedFile } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// `gemini-omni-flash-preview` is served by the Interactions API. On Vertex the
// model is currently only available in the `global` region, so pin the location
// explicitly rather than relying on `GOOGLE_VERTEX_LOCATION`. Uses standard
// Google Cloud credentials (not Express Mode API keys).
const vertex = createGoogleVertex({ location: 'global' });

run(async () => {
  const videos: Array<GeneratedFile> = [];

  await withSpinner('Generating video...', async () => {
    const result = streamText({
      model: vertex.interactions('gemini-omni-flash-preview'),
      prompt:
        'A marble rolling fast on a chain reaction style track, continuous smooth shot.',
      providerOptions: {
        google: {
          store: false,
        } satisfies GoogleLanguageModelInteractionsOptions,
      },
    });

    for await (const part of result.stream) {
      switch (part.type) {
        case 'text-delta': {
          process.stdout.write(part.text);
          break;
        }
        case 'file': {
          if (part.file.mediaType.startsWith('video/')) {
            videos.push(part.file);
          }
          break;
        }
      }
    }

    console.log();
    console.log(
      'Interaction id:',
      (await result.finalStep).providerMetadata?.google?.interactionId,
    );
  });

  if (videos.length > 0) {
    await presentVideos(videos);
  }
});
