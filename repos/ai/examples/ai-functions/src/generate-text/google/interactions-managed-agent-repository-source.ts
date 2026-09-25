import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
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

    const result = await generateText({
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

    console.log(result.text);
    console.log();
    console.log('Token usage:', result.usage);
  } finally {
    await deleteGoogleManagedAgent({ name });
    console.log(`Deleted managed agent: ${name}`);
  }
});
