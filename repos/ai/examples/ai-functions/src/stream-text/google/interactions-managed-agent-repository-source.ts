import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText } from 'ai';
import { randomUUID } from 'node:crypto';
import { cancelOnSigint } from '../../lib/cancel-on-sigint';
import {
  createGoogleManagedAgent,
  deleteGoogleManagedAgent,
} from '../../lib/google-managed-agents';
import { run } from '../../lib/run';

run(async () => {
  const ac = cancelOnSigint();
  const name = `ai-sdk-example-${randomUUID()}`;

  try {
    await createGoogleManagedAgent({
      name,
      baseAgent: 'antigravity-preview-05-2026',
      instructions:
        'You are a helpful assistant that inspects repositories on disk.',
    });
    console.log(`Created managed agent: ${name}`);

    const result = streamText({
      model: google.interactions({ managedAgent: name }),
      prompt:
        'List every file in /repo/ (recurse into subdirectories) and report the count.',
      abortSignal: ac.signal,
      providerOptions: {
        google: {
          environment: {
            type: 'remote',
            sources: [
              {
                type: 'repository',
                source: 'https://github.com/octocat/Hello-World',
                target: '/repo/',
              },
            ],
          },
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
  } finally {
    await deleteGoogleManagedAgent({ name });
    console.log(`Deleted managed agent: ${name}`);
  }
});
