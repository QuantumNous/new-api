import { type GoogleLanguageModelInteractionsOptions } from '@ai-sdk/google';
import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { generateText, type ModelMessage } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

const vertex = createGoogleVertex({ location: 'global' });
const model = vertex.interactions('gemini-omni-flash-preview');

run(async () => {
  // Stateless modify: Vertex does not support `previousInteractionId` for this
  // model, so pass `store: false` and re-send the full conversation history
  // every turn (including the assistant video from turn 1).
  const messages: Array<ModelMessage> = [
    {
      role: 'user',
      content:
        'A marble rolling fast on a chain reaction style track, continuous smooth shot.',
    },
  ];

  console.log('--- Turn 1: generate ---');
  const turn1 = await withSpinner('Generating video...', () =>
    generateText({
      model,
      messages,
      providerOptions: {
        google: {
          store: false,
        } satisfies GoogleLanguageModelInteractionsOptions,
      },
    }),
  );

  console.log('Turn 1 text:', turn1.text);
  console.log(
    'Turn 1 interaction id:',
    turn1.finalStep.providerMetadata?.google?.interactionId,
  );
  console.log('Turn 1 files:', turn1.files.length);

  const turn1Videos = turn1.files.filter(file =>
    file.mediaType.startsWith('video/'),
  );
  if (turn1Videos.length > 0) {
    await presentVideos(turn1Videos);
  }

  messages.push(...turn1.response.messages);
  messages.push({
    role: 'user',
    content: 'Make the marble blue.',
  });

  console.log();
  console.log('--- Turn 2: modify (make the marble blue) ---');
  const turn2 = await withSpinner('Modifying video...', () =>
    generateText({
      model,
      messages,
      providerOptions: {
        google: {
          store: false,
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
