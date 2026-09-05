import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { cancelOnSigint } from '../../lib/cancel-on-sigint';
import { run } from '../../lib/run';

run(async () => {
  const ac = cancelOnSigint();

  const result = await generateText({
    model: google.interactions({ agent: 'antigravity-preview-05-2026' }),
    prompt: 'What is 2 + 2?',
    abortSignal: ac.signal,
    providerOptions: {
      google: {
        environment: 'remote',
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
