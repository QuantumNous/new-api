import { resolve, type FetchFunction } from '@ai-sdk/provider-utils';
import {
  generateAuthToken,
  type GoogleCredentials,
} from '../../edge/google-vertex-auth-edge';
import {
  createGoogleVertexXai as createGoogleVertexXaiOriginal,
  type GoogleVertexXaiProvider,
  type GoogleVertexXaiProviderSettings as GoogleVertexXaiProviderSettingsOriginal,
} from '../google-vertex-xai-provider';
export type { GoogleVertexXaiProvider };

export interface GoogleVertexXaiProviderSettings extends GoogleVertexXaiProviderSettingsOriginal {
  /**
   * Optional. The Google credentials for the Google Cloud service account. If
   * not provided, the Google Vertex provider will use environment variables to
   * load the credentials.
   */
  googleCredentials?: GoogleCredentials;
}

/**
 * Create a Google Vertex AI xAI provider instance for Edge runtimes.
 * Uses the OpenAI-compatible Chat Completions API for Grok partner models.
 * Automatically handles Google Cloud authentication.
 *
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/grok
 */
export function createGoogleVertexXai(
  options: GoogleVertexXaiProviderSettings = {},
): GoogleVertexXaiProvider {
  const customFetch: FetchFunction = async (url, init) => {
    const token = await generateAuthToken(options.googleCredentials);
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
 * Default Google Vertex AI xAI provider instance for Edge runtimes.
 */
export const googleVertexXai = createGoogleVertexXai();
