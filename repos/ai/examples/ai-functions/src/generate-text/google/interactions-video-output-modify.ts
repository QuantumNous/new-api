import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const model = google.interactions('gemini-omni-flash-preview');

  console.log('--- Turn 1: generate ---');
  const turn1 = await withSpinner('Generating video (turn 1)...', () =>
    generateText({
      model,
      prompt:
        'A red marble rolling fast on a chain reaction style track, continuous smooth shot.',
      providerOptions: {
        google: {
          responseModalities: ['video'],
        } satisfies GoogleLanguageModelInteractionsOptions,
      },
    }),
  );

  const interactionId = turn1.finalStep.providerMetadata?.google
    ?.interactionId as string | undefined;
  console.log('Turn 1 text:', turn1.text);
  console.log('Turn 1 interaction id:', interactionId);
  console.log('Turn 1 files:', turn1.files.length);
  const turn1Videos = turn1.files.filter(file =>
    file.mediaType.startsWith('video/'),
  );
  if (turn1Videos.length > 0) {
    await presentVideos(turn1Videos);
  }

  if (interactionId == null) {
    throw new Error(
      'No interactionId returned from turn 1; cannot chain a modify turn.',
    );
  }

  console.log();
  console.log('--- Turn 2: modify (now make the marble blue) ---');
  const turn2 = await withSpinner('Generating video (turn 2)...', () =>
    generateText({
      model,
      prompt: 'now make the marble blue',
      providerOptions: {
        google: {
          responseModalities: ['video'],
          previousInteractionId: interactionId,
        } satisfies GoogleLanguageModelInteractionsOptions,
      },
    }),
  );

  console.log('Turn 2 text:', turn2.text);
  console.log(
    'Turn 2 interaction id:',
    turn2.finalStep.providerMetadata?.google?.interactionId,
  );
  console.log('Turn 2 files:', turn2.files.length);
  const turn2Videos = turn2.files.filter(file =>
    file.mediaType.startsWith('video/'),
  );
  if (turn2Videos.length > 0) {
    await presentVideos(turn2Videos);
  }
});
