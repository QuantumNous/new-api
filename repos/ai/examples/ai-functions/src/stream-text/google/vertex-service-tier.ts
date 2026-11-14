import type {
  GoogleLanguageModelOptions,
  GoogleProviderMetadata,
} from '@ai-sdk/google';
import { googleVertex } from '@ai-sdk/google-vertex';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: googleVertex('gemini-3.1-pro-preview'),
    prompt: 'What color is the sky in one word?',
    providerOptions: {
      vertex: {
        sharedRequestType: 'priority',
      } satisfies GoogleLanguageModelOptions,
    },
  });

  await result.consumeStream();

  const metadata = (await result.finalStep).providerMetadata?.googleVertex as
    | GoogleProviderMetadata
    | undefined;

  console.log(await result.text);
  console.log('trafficType:', metadata?.usageMetadata?.trafficType);
});
