import { resolve, type FetchFunction } from '@ai-sdk/provider-utils';
import type { GoogleAuthOptions } from 'google-auth-library';
import { createAuthTokenGenerator } from '../google-vertex-auth-google-auth-library';
import {
  createGoogleVertexMaas as createVertexMaasOriginal,
  type GoogleVertexMaasProvider,
  type GoogleVertexMaasProviderSettings as GoogleVertexMaasProviderSettingsOriginal,
} from './google-vertex-maas-provider';
export type { GoogleVertexMaasProvider };

export interface GoogleVertexMaasProviderSettings extends GoogleVertexMaasProviderSettingsOriginal {
  /**
   * Optional. The Authentication options provided by google-auth-library.
   * Complete list of authentication options is documented in the
   * GoogleAuthOptions interface:
   * https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/googleauth.ts.
   */
  googleAuthOptions?: GoogleAuthOptions;
}

/**
 * Create a Google Vertex AI MaaS (Model as a Service) provider instance for Node.js.
 * Uses the OpenAI-compatible Chat Completions API for partner and open models.
 * Automatically handles Google Cloud authentication.
 *
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/maas/use-open-models
 */
export function createGoogleVertexMaas(
  options: GoogleVertexMaasProviderSettings = {},
): GoogleVertexMaasProvider {
  const generateAuthToken = createAuthTokenGenerator(options.googleAuthOptions);

  // Create a custom fetch wrapper that adds auth headers
  const customFetch: FetchFunction = async (url, init) => {
    const token = await generateAuthToken();
    const resolvedHeaders = await resolve(options.headers);
    const authHeaders = {
      ...resolvedHeaders,
      Authorization: `Bearer ${token}`,
    };

    // Merge auth headers with existing headers from init
    const fetchInit = {
      ...init,
      headers: {
        ...init?.headers,
        ...authHeaders,
      },
    };

    // Call the original fetch or user's custom fetch
    return (options.fetch ?? fetch)(url, fetchInit);
  };

  return createVertexMaasOriginal({
    ...options,
    fetch: customFetch,
    headers: undefined, // Don't pass headers, we handle them in fetch
  });
}

/**
 * Default Google Vertex AI MaaS provider instance for Node.js.
 */
export const googleVertexMaas = createGoogleVertexMaas();
