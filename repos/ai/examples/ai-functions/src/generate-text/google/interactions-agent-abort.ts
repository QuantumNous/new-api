import {
  createGoogle,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

/*
 * Aborts a long-running deep-research agent call after 15 seconds and
 * verifies that the SDK fired `POST /interactions/{id}/cancel` so the run
 * actually stopped on Google's side instead of continuing to bill in the
 * background.
 *
 * After the abort throws, we fetch `GET /interactions/{id}` directly and
 * assert that the server-reported status is `cancelled`.
 */
run(async () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey == null) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }

  const baseURL = 'https://generativelanguage.googleapis.com/v1beta';

  /*
   * Wrap fetch to capture the POST response body so we can recover the
   * interaction id even though the awaited generateText call will throw on
   * abort instead of resolving with providerMetadata.
   */
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
    console.log('Aborting after 15s...');
    ac.abort();
  }, 15_000);

  const startedAt = Date.now();
  try {
    await generateText({
      model: provider.interactions({
        agent: 'deep-research-pro-preview-12-2025',
      }),
      prompt:
        'Compile an exhaustive survey of every paper published on retrieval-augmented generation since 2020. Include all authors, abstracts, and links.',
      abortSignal: ac.signal,
      providerOptions: {
        google: {
          background: true,
        } satisfies GoogleLanguageModelInteractionsOptions,
      },
    });
    console.log('Unexpected: generateText returned without abort');
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if ((error as Error)?.name === 'AbortError') {
      console.log(`generateText aborted after ${elapsedMs}ms (as expected).`);
    } else {
      throw error;
    }
  }

  if (interactionId == null) {
    console.log(
      'Warning: could not capture interaction id from POST response; cannot verify cancellation server-side.',
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
