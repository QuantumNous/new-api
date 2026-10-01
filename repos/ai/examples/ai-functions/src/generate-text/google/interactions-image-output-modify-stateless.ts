import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText, type ModelMessage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const model = google.interactions('gemini-3-pro-image-preview');

  // Stateless modify: pass `store: false` and re-send the full conversation
  // history every turn (including the assistant image from turn 1). No
  // `previous_interaction_id` is used — the model must reconstruct the prior
  // image context from the messages we re-send.
  const messages: Array<ModelMessage> = [
    {
      role: 'user',
      content: 'Generate an image of a comic cat in a spaceship.',
    },
  ];

  console.log('--- Turn 1: generate ---');
  const turn1 = await generateText({
    model,
    messages,
    providerOptions: {
      google: {
        responseModalities: ['image'],
        store: false,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log('Turn 1 text:', turn1.text);
  console.log(
    'Turn 1 interaction id:',
    turn1.finalStep.providerMetadata?.google?.interactionId,
  );
  console.log('Turn 1 files:', turn1.files.length);
  const turn1Images = turn1.files.filter(file =>
    file.mediaType.startsWith('image/'),
  );
  if (turn1Images.length > 0) {
    await presentImages(turn1Images);
  }

  messages.push(...turn1.response.messages);
  messages.push({
    role: 'user',
    content: 'now make the cat red',
  });

  console.log();
  console.log('--- Turn 2: modify (now make it red) ---');
  const turn2 = await generateText({
    model,
    messages,
    providerOptions: {
      google: {
        responseModalities: ['image'],
        store: false,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log('Turn 2 text:', turn2.text);
  console.log(
    'Turn 2 interaction id:',
    turn2.finalStep.providerMetadata?.google?.interactionId,
  );
  console.log('Turn 2 files:', turn2.files.length);
  const turn2Images = turn2.files.filter(file =>
    file.mediaType.startsWith('image/'),
  );
  if (turn2Images.length > 0) {
    await presentImages(turn2Images);
  }
});
