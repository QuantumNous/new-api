import {
  google,
  type GoogleLanguageModelOptions,
  type GoogleProviderMetadata,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-3.1-flash-image-preview'),
    tools: {
      google_search: google.tools.googleSearch({
        searchTypes: { imageSearch: {} },
      }),
    },
    providerOptions: {
      google: {
        responseModalities: ['TEXT', 'IMAGE'],
      } satisfies GoogleLanguageModelOptions,
    },
    prompt:
      'Search for live footage photos of the 2026 Super Bowl halftime show artist. I want an image with a close-up of them during the show, but in space.',
  });

  for (const file of result.files) {
    if (file.mediaType.startsWith('image/')) {
      await presentImages([file]);
    }
  }

  console.log('SOURCES');
  console.log(result.sources);

  const metadata = result.finalStep.providerMetadata?.google as
    | GoogleProviderMetadata
    | undefined;
  const groundingMetadata = metadata?.groundingMetadata;

  console.log();
  console.log('GROUNDING METADATA');
  console.log(groundingMetadata);
});
