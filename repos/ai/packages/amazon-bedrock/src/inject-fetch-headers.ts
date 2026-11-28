import {
  getRuntimeEnvironmentUserAgent,
  normalizeHeaders,
  withUserAgentSuffix,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { VERSION } from './version';

/**
 * Test helper to inject custom headers into a fetch request.
 * @param customHeaders - The headers to inject.
 * @returns A fetch function that injects the custom headers.
 */
export function injectFetchHeaders(
  customHeaders: Record<string, string>,
): FetchFunction {
  return async (input, init = {}) => {
    const headers = withUserAgentSuffix(
      {
        ...normalizeHeaders(init.headers),
        ...customHeaders,
      },
      `ai-sdk/amazon-bedrock/${VERSION}`,
      getRuntimeEnvironmentUserAgent(),
    );

    return await globalThis.fetch(input, {
      ...init,
      headers,
    });
  };
}
