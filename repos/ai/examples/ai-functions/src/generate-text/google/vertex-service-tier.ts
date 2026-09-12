import type {
  GoogleLanguageModelOptions,
  GoogleProviderMetadata,
} from '@ai-sdk/google';
import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: googleVertex('gemini-3.1-pro-preview'),
    prompt: 'What color is the sky in one word?',
    providerOptions: {
      vertex: {
        sharedRequestType: 'priority',
      } satisfies GoogleLanguageModelOptions,
    },
  });

  const metadata = result.finalStep.providerMetadata?.googleVertex as
    | GoogleProviderMetadata
    | undefined;

  console.log(result.text);
  console.log('trafficType:', metadata?.usageMetadata?.trafficType);
});
