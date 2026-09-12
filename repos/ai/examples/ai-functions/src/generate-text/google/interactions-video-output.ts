import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const result = await withSpinner('Generating video...', () =>
    generateText({
      model: google.interactions('gemini-omni-flash-preview'),
      prompt:
        'A marble rolling fast on a chain reaction style track, continuous smooth shot.',
      providerOptions: {
        google: {
          responseModalities: ['video'],
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
