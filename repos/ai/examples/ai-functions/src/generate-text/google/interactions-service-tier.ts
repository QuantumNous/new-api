import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    prompt: 'What color is the sky in one word?',
    providerOptions: {
      google: {
        serviceTier: 'priority',
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log(
    'serviceTier:',
    result.finalStep.providerMetadata?.google?.serviceTier,
  );
});
