import {
  google,
  type GoogleLanguageModelOptions,
  type GoogleProviderMetadata,
} from '@ai-sdk/google';
import { streamText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
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

  for await (const part of result.stream) {
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

      case 'source': {
        if (part.sourceType === 'url') {
          console.log('\x1b[36m%s\x1b[0m', 'Source');
          console.log('ID:', part.id);
          console.log('Title:', part.title);
          console.log('URL:', part.url);
          console.log();
        }
        break;
      }
    }
  }

  const metadata = (await result.finalStep).providerMetadata?.google as
    | GoogleProviderMetadata
    | undefined;
  const groundingMetadata = metadata?.groundingMetadata;

  console.log();
  console.log('GROUNDING METADATA');
  console.log(groundingMetadata);
});
