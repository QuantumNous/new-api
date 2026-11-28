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
        'You are a helpful assistant. When asked about a file, read it and report its contents verbatim.',
    });
    console.log(`Created managed agent: ${name}`);

    const result = await generateText({
      model: google.interactions({ managedAgent: name }),
      prompt:
        'Read the file at /data/note.txt and tell me exactly what it contains.',
      abortSignal: ac.signal,
      providerOptions: {
        google: {
          environment: {
            type: 'remote',
            sources: [
              {
                type: 'inline',
                content: 'hello from the AI SDK example\n',
                target: '/data/note.txt',
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
