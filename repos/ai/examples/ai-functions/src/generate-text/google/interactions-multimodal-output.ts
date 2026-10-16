import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google.interactions('gemini-2.5-flash-image'),
    prompt:
      'Tell me a three sentence bedtime story about a unicorn, accompanied by a suitable illustration.',
    providerOptions: {
      google: {
        responseModalities: ['text', 'image'],
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log('Text:', result.text);
  console.log();

  const images = result.files.filter(file =>
    file.mediaType.startsWith('image/'),
  );
  if (images.length > 0) {
    await presentImages(images);
  }

  console.log(
    'Interaction id:',
    result.finalStep.providerMetadata?.google?.interactionId,
  );
});
