import {
  combineHeaders,
  getRuntimeEnvironmentUserAgent,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';

const getOriginalFetch = () => globalThis.fetch;

/**
 * Best-effort `POST /interactions/{id}/cancel` to stop a background interaction
 * on Google's side after the caller has aborted locally. Errors and non-2xx
 * responses are swallowed so a cancel failure cannot mask the original abort.
 *
 * Skips the request entirely if `interactionId` is missing/empty -- e.g. when
 * the interaction was created with `store: false` and the API did not return an
 * id.
 */
export async function cancelGoogleInteraction({
  baseURL,
  interactionId,
  headers,
  fetch = getOriginalFetch(),
}: {
  baseURL: string;
  interactionId: string | null | undefined;
  headers: Record<string, string | undefined>;
  fetch?: FetchFunction;
}): Promise<void> {
  if (interactionId == null || interactionId.length === 0) {
    return;
  }

  const url = `${baseURL}/interactions/${encodeURIComponent(interactionId)}/cancel`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: withUserAgentSuffix(
        combineHeaders({ 'Content-Type': 'application/json' }, headers),
        getRuntimeEnvironmentUserAgent(),
      ),
      body: '{}',
    });

    /*
     * Drain the body so undici/Node can return the connection to the pool.
     * Errors (e.g. non-2xx, network failure) are intentionally ignored: this
     * is a best-effort cleanup and must not throw past the caller, which is
     * already handling an aborted/failed run.
     */
    try {
      await response.text();
    } catch {
      // ignore
    }
  } catch {
    // ignore -- cancel is best-effort
  }
}
