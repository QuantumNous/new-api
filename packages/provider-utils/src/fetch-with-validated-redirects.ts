import { cancelResponseBody } from './cancel-response-body';
import { DownloadError } from './download-error';
import { isBrowserRuntime } from './is-browser-runtime';
import { validateDownloadUrl } from './validate-download-url';

const MAX_DOWNLOAD_REDIRECTS = 10;

/**
 * Fetches a URL while enforcing the SSRF download guard on every hop.
 *
 * Redirects are followed manually (`redirect: 'manual'`) so each hop is
 * validated with {@link validateDownloadUrl} *before* it is requested. Relying
 * on the default `redirect: 'follow'` would issue the request to a redirect
 * target (e.g. an internal address) before we ever see its URL, defeating the
 * SSRF guard.
 *
 * A `redirect: 'manual'` request yields an unreadable opaque response in the
 * browser (and in other spec-compliant fetch implementations), so the redirect
 * target cannot be validated here. In a real browser this is safe to follow
 * natively because SSRF is not reachable (fetch is constrained by CORS and
 * cannot reach a server's internal network or cloud-metadata). On any other
 * runtime we cannot validate the hop, so we fail closed rather than follow it
 * blindly and bypass the SSRF guard.
 *
 * The returned response is the final (non-redirect) response. The caller is
 * responsible for checking `response.ok` and reading the body.
 *
 * @throws DownloadError if a hop is unsafe, the redirect limit is exceeded, or
 * a redirect cannot be validated on a non-browser runtime.
 */
export async function fetchWithValidatedRedirects({
  url,
  headers,
  abortSignal,
  maxRedirects = MAX_DOWNLOAD_REDIRECTS,
}: {
  url: string;
  headers?: HeadersInit;
  abortSignal?: AbortSignal;
  maxRedirects?: number;
}): Promise<Response> {
  // Per-hop request options. Only the `redirect` mode varies between hops, so
  // the rest is assembled once. `headers` is omitted entirely when not provided
  // so callers that send none issue a bare request.
  const baseInit: RequestInit = { signal: abortSignal };
  if (headers !== undefined) {
    baseInit.headers = headers;
  }

  let currentUrl = url;
  // The bound also acts as a backstop against an unterminated redirect chain.
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    validateDownloadUrl(currentUrl);

    const response = await fetch(currentUrl, {
      ...baseInit,
      redirect: 'manual',
    });

    if (response.type === 'opaqueredirect') {
      if (!isBrowserRuntime()) {
        throw new DownloadError({
          url,
          message: `Redirect from ${currentUrl} could not be validated and was blocked`,
        });
      }
      return await fetch(currentUrl, { ...baseInit, redirect: 'follow' });
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      // Release the redirect response's connection before moving to the next
      // hop. Whether that hop is followed or rejected by the SSRF guard, an
      // unconsumed 3xx body would leak the underlying socket.
      await cancelResponseBody(response);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new DownloadError({
    url,
    message: `Too many redirects (max ${maxRedirects})`,
  });
}
