import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText } from 'ai';
import { cancelOnSigint } from '../../lib/cancel-on-sigint';
import { run } from '../../lib/run';

run(async () => {
  const ac = cancelOnSigint();

  const result = streamText({
    model: google.interactions({ agent: 'antigravity-preview-05-2026' }),
    prompt: 'What is 2 + 2?',
    abortSignal: ac.signal,
    providerOptions: {
      google: {
        environment: 'remote',
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  for await (const part of result.stream) {
    if (part.type === 'reasoning-delta') {
      process.stdout.write(`\x1b[2m${part.text}\x1b[0m`);
    } else if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }
  }
  console.log();

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
