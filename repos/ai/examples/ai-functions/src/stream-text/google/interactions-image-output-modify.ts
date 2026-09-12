import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const model = google.interactions('gemini-3-pro-image-preview');

  console.log('--- Turn 1: generate ---');
  const turn1 = streamText({
    model,
    prompt: 'Generate an image of a comic cat in a spaceship.',
    providerOptions: {
      google: {
        responseModalities: ['image'],
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

  const turn1Metadata = await turn1.providerMetadata;
  const interactionId = turn1Metadata?.google?.interactionId as
    | string
    | undefined;
  console.log();
  console.log('Turn 1 interaction id:', interactionId);

  if (interactionId == null) {
    throw new Error(
      'No interactionId returned from turn 1; cannot chain a modify turn.',
    );
  }

  console.log();
  console.log('--- Turn 2: modify (now make it red) ---');
  const turn2 = streamText({
    model,
    prompt: 'now make the cat red',
    providerOptions: {
      google: {
        responseModalities: ['image'],
        previousInteractionId: interactionId,
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
