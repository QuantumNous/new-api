import {
  google,
  type GoogleLanguageModelOptions,
  type GoogleProviderMetadata,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    tools: {
      google_maps: google.tools.googleMaps({}),
    },
    providerOptions: {
      google: {
        retrievalConfig: {
          latLng: { latitude: 34.09, longitude: -117.88 },
        },
      } satisfies GoogleLanguageModelOptions,
    },
    prompt:
      'What are the best Italian restaurants within a 15-minute walk from here?',
  });

  const { text, sources } = result;
  const providerMetadata = result.finalStep.providerMetadata;
  const metadata = providerMetadata?.google as
    | GoogleProviderMetadata
    | undefined;
  const groundingMetadata = metadata?.groundingMetadata;

  console.log('Generated Text:', text);
  console.dir({ sources }, { depth: null });
  console.dir({ groundingMetadata }, { depth: null });
});
