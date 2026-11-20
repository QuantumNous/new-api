import { resolve, type FetchFunction } from '@ai-sdk/provider-utils';
import type { GoogleAuthOptions } from 'google-auth-library';
import { createAuthTokenGenerator } from '../google-vertex-auth-google-auth-library';
import {
  createGoogleVertexXai as createGoogleVertexXaiOriginal,
  type GoogleVertexXaiProvider,
  type GoogleVertexXaiProviderSettings as GoogleVertexXaiProviderSettingsOriginal,
} from './google-vertex-xai-provider';
export type { GoogleVertexXaiProvider };

export interface GoogleVertexXaiProviderSettings extends GoogleVertexXaiProviderSettingsOriginal {
  /**
   * Optional. The Authentication options provided by google-auth-library.
   * Complete list of authentication options is documented in the
   * GoogleAuthOptions interface:
   * https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/googleauth.ts.
   */
  googleAuthOptions?: GoogleAuthOptions;
}

/**
 * Create a Google Vertex AI xAI provider instance for Node.js.
 * Uses the OpenAI-compatible Chat Completions API for Grok partner models.
 * Automatically handles Google Cloud authentication.
 *
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/grok
 */
export function createGoogleVertexXai(
  options: GoogleVertexXaiProviderSettings = {},
): GoogleVertexXaiProvider {
  const generateAuthToken = createAuthTokenGenerator(options.googleAuthOptions);

  const customFetch: FetchFunction = async (url, init) => {
    const token = await generateAuthToken();
    const resolvedHeaders = await resolve(options.headers);
    const authHeaders = {
      ...resolvedHeaders,
      Authorization: `Bearer ${token}`,
    };

    const fetchInit = {
      ...init,
      headers: {
        ...init?.headers,
        ...authHeaders,
      },
    };

    return (options.fetch ?? fetch)(url, fetchInit);
  };

  return createGoogleVertexXaiOriginal({
    ...options,
    fetch: customFetch,
    headers: undefined,
  });
}

/**
 * Default Google Vertex AI xAI provider instance for Node.js.
 */
export const googleVertexXai = createGoogleVertexXai();
