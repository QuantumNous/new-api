import {
  createGoogle,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

/*
 * Aborts a long-running deep-research agent stream after 15 seconds and
 * verifies that the SDK fired `POST /interactions/{id}/cancel` so the run
 * actually stopped on Google's side instead of continuing to bill in the
 * background.
 *
 * The interaction id is captured by wrapping `fetch` and peeking the POST
 * response body, since the `streamText` result's `providerMetadata` only
 * resolves after the stream finishes -- which it won't, given the abort.
 */
run(async () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey == null) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }

  const baseURL = 'https://generativelanguage.googleapis.com/v1beta';

  let interactionId: string | undefined;
  const capturingFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (
      url.endsWith('/interactions') &&
      (init?.method ?? 'GET').toUpperCase() === 'POST' &&
      response.ok
    ) {
      const cloned = response.clone();
      try {
        const body = (await cloned.json()) as { id?: string };
        if (typeof body.id === 'string') {
          interactionId = body.id;
        }
      } catch {
        // ignore -- best-effort capture
      }
    }
    return response;
  };

  const provider = createGoogle({
    apiKey,
    baseURL,
    fetch: capturingFetch,
  });

  const ac = new AbortController();
  setTimeout(() => {
    console.log('\nAborting after 15s...');
    ac.abort();
  }, 15_000);

  const startedAt = Date.now();
  const result = streamText({
    model: provider.interactions({
      agent: 'deep-research-pro-preview-12-2025',
    }),
    providerOptions: {
      google: {
        agentConfig: {
          type: 'deep-research',
          thinkingSummaries: 'auto',
        },
        background: true,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
    prompt:
      'Compile an exhaustive survey of every paper published on retrieval-augmented generation since 2020. Include all authors, abstracts, and links.',
    abortSignal: ac.signal,
  });

  try {
    for await (const part of result.stream) {
      if (part.type === 'reasoning-delta') {
        process.stdout.write(`\x1b[2m${part.text}\x1b[0m`);
      } else if (part.type === 'text-delta') {
        process.stdout.write(part.text);
      }
    }
    console.log('\nUnexpected: stream completed without abort');
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if ((error as Error)?.name === 'AbortError') {
      console.log(`streamText aborted after ${elapsedMs}ms (as expected).`);
    } else {
      throw error;
    }
  }

  if (interactionId == null) {
    console.log(
      'Warning: stream did not yield a response-metadata event before abort; cannot verify cancellation server-side.',
    );
    return;
  }

  console.log('Verifying server-side status of', interactionId);
  const verify = await fetch(`${baseURL}/interactions/${interactionId}`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  const body = (await verify.json()) as { status?: string };
  console.log('Server-reported status:', body.status);
  if (body.status === 'cancelled') {
    console.log('Cancel confirmed -- the agent stopped running.');
  } else {
    console.log(
      'Status is not "cancelled" yet; the cancel may still be propagating.',
    );
  }
});
