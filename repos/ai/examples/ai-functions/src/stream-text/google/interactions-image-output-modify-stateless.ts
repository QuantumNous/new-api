import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText, type ModelMessage } from 'ai';
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
  const turn1 = streamText({
    model,
    messages,
    providerOptions: {
      google: {
        responseModalities: ['image'],
        store: false,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  for await (const part of turn1.stream) {
    switch (part.type) {
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }
      case 'file': {
        if (part.file.mediaType.startsWith('image/')) {
          await presentImages([part.file]);
        }
        break;
      }
    }
  }

  console.log();
  console.log(
    'Turn 1 interaction id:',
    (await turn1.providerMetadata)?.google?.interactionId,
  );

  messages.push(...(await turn1.response).messages);
  messages.push({
    role: 'user',
    content: 'now make the cat red',
  });

  console.log();
  console.log('--- Turn 2: modify (now make it red) ---');
  const turn2 = streamText({
    model,
    messages,
    providerOptions: {
      google: {
        responseModalities: ['image'],
        store: false,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  for await (const part of turn2.stream) {
    switch (part.type) {
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }
      case 'file': {
        if (part.file.mediaType.startsWith('image/')) {
          await presentImages([part.file]);
        }
        break;
      }
    }
  }

  console.log();
  console.log(
    'Turn 2 interaction id:',
    (await turn2.providerMetadata)?.google?.interactionId,
  );
});
