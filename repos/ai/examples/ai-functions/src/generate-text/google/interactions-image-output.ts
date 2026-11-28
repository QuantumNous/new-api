import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google.interactions('gemini-3-pro-image-preview'),
    prompt: 'Generate an image of a comic cat in a spaceship.',
    providerOptions: {
      google: {
        responseModalities: ['image'],
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log(
    'Interaction id:',
    result.finalStep.providerMetadata?.google?.interactionId,
  );
  console.log('Files:', result.files.length);

  const images = result.files.filter(file =>
    file.mediaType.startsWith('image/'),
  );
  if (images.length > 0) {
    await presentImages(images);
  }
});
