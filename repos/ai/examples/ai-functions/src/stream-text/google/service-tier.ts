import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-3.1-pro-preview'),
    prompt: 'What color is the sky in one word?',
    providerOptions: {
      google: {
        serviceTier: 'priority',
      } satisfies GoogleLanguageModelOptions,
    },
  });

  await result.consumeStream();

  console.log(await result.text);
  console.log(
    'serviceTier:',
    (await result.finalStep).providerMetadata?.google?.serviceTier,
  );
});
