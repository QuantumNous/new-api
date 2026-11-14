import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const model = google.interactions('gemini-3-pro-image-preview');

  console.log('--- Turn 1: generate ---');
  const turn1 = await generateText({
    model,
    prompt: 'Generate an image of a comic cat in a spaceship.',
    providerOptions: {
      google: {
        responseModalities: ['image'],
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  const interactionId = turn1.finalStep.providerMetadata?.google
    ?.interactionId as string | undefined;
  console.log('Turn 1 text:', turn1.text);
  console.log('Turn 1 interaction id:', interactionId);
  console.log('Turn 1 files:', turn1.files.length);
  const turn1Images = turn1.files.filter(file =>
    file.mediaType.startsWith('image/'),
  );
  if (turn1Images.length > 0) {
    await presentImages(turn1Images);
  }

  if (interactionId == null) {
    throw new Error(
      'No interactionId returned from turn 1; cannot chain a modify turn.',
    );
  }

  console.log();
  console.log('--- Turn 2: modify (now make it red) ---');
  const turn2 = await generateText({
    model,
    prompt: 'now make the cat red',
    providerOptions: {
      google: {
        responseModalities: ['image'],
        previousInteractionId: interactionId,
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
