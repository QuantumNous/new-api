import { APICallError } from '@ai-sdk/provider';
import { extractResponseHeaders } from './extract-response-headers';
import { fetchWithValidatedRedirects } from './fetch-with-validated-redirects';
import type { FetchFunction } from './fetch-function';
import { handleFetchError } from './handle-fetch-error';
import { isAbortError } from './is-abort-error';
import { isSameOrigin } from './is-same-origin';
import type { ResponseHandler } from './response-handler';
import { getRuntimeEnvironmentUserAgent } from './get-runtime-environment-user-agent';
import { withUserAgentSuffix } from './with-user-agent-suffix';
import { VERSION } from './version';

// use function to allow for mocking in tests:
const getOriginalFetch = () => globalThis.fetch;

export const getFromApi = async <T>({
  url,
  headers = {},
  successfulResponseHandler,
  failedResponseHandler,
  abortSignal,
  fetch = getOriginalFetch(),
  validateUrl,
  credentialedOrigin,
  trustedOrigin,
}: {
  url: string;
  headers?: Record<string, string | undefined>;
  failedResponseHandler: ResponseHandler<Error>;
  successfulResponseHandler: ResponseHandler<T>;
  abortSignal?: AbortSignal;
  fetch?: FetchFunction;
  /**
   * Set `true` when `url` is untrusted (e.g. taken from a provider response
   * body): it is routed through {@link fetchWithValidatedRedirects}, which
   * rejects private/loopback/link-local targets and re-validates redirect
   * hops; blocked URLs throw `DownloadError`. Set `false` only for URLs built
   * from a developer-configured endpoint.
   *
   * Optional for backwards compatibility with existing callers; omitting it
   * behaves like `false` (no validation). Provider code in this repository
   * must always pass it explicitly so every call site makes a visible trust
   * decision — see `contributing/secure-url-handling.md`.
   */
  validateUrl?: boolean;
  /**
   * When set, `headers` are sent only if `url` is same-origin with this origin
   * (the user-agent suffix is always kept). Pass the provider's configured
   * base URL alongside `validateUrl: true` so credentials never ride a request
   * to a response-supplied host on a different origin (e.g. a CDN). Redirects
   * that later cross origin drop all caller headers regardless (see
   * {@link fetchWithValidatedRedirects}).
   */
  credentialedOrigin?: string;
  /**
   * A developer-configured origin (e.g. the provider's `baseURL`) that is
   * exempt from URL validation when `validateUrl` is `true`. A response URL
   * (or redirect hop) that is same-origin with it is fetched without target
   * validation — it points at exactly the host a config-derived
   * `validateUrl: false` request would fetch anyway, so blocking it would
   * only break legitimate self-hosted / localhost deployments whose response
   * URLs point back at the configured host. Hops on any other origin are
   * still validated. Must never be derived from response data.
   */
  trustedOrigin?: string;
}) => {
  try {
    // Withhold caller headers when the URL is not same-origin with the origin
    // allowed to receive credentials; the user-agent suffix is still applied.
    const outgoingHeaders =
      credentialedOrigin !== undefined && !isSameOrigin(url, credentialedOrigin)
        ? {}
        : headers;

    const requestHeaders = withUserAgentSuffix(
      outgoingHeaders,
      `ai-sdk/provider-utils/${VERSION}`,
      getRuntimeEnvironmentUserAgent(),
    );

    const response = validateUrl
      ? await fetchWithValidatedRedirects({
          url,
          headers: requestHeaders,
          abortSignal,
          fetch,
          trustedOrigin,
        })
      : await fetch(url, {
          method: 'GET',
          headers: requestHeaders,
          signal: abortSignal,
        });

    const responseHeaders = extractResponseHeaders(response);

    if (!response.ok) {
      let errorInformation: {
        value: Error;
        responseHeaders?: Record<string, string> | undefined;
      };

      try {
        errorInformation = await failedResponseHandler({
          response,
          url,
          requestBodyValues: {},
        });
      } catch (error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }

        throw new APICallError({
          message: 'Failed to process error response',
          cause: error,
          statusCode: response.status,
          url,
          responseHeaders,
          requestBodyValues: {},
        });
      }

      throw errorInformation.value;
    }

    try {
      return await successfulResponseHandler({
        response,
        url,
        requestBodyValues: {},
      });
    } catch (error) {
      if (error instanceof Error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }
      }

      throw new APICallError({
        message: 'Failed to process successful response',
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: {},
      });
    }
  } catch (error) {
    throw handleFetchError({ error, url, requestBodyValues: {} });
  }
};
