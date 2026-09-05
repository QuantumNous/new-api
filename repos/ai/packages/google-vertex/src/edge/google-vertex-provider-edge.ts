import { loadOptionalSetting, resolve } from '@ai-sdk/provider-utils';
import {
  createGoogleVertex as createGoogleVertexOriginal,
  type GoogleVertexProvider,
  type GoogleVertexProviderSettings as GoogleVertexProviderSettingsOriginal,
} from '../google-vertex-provider-base';
import {
  generateAuthToken,
  type GoogleCredentials,
} from './google-vertex-auth-edge';
export type { GoogleVertexProvider };

export interface GoogleVertexProviderSettings extends GoogleVertexProviderSettingsOriginal {
  /**
   * Optional. The Google credentials for the Google Cloud service account. If
   * not provided, the Google Vertex provider will use environment variables to
   * load the credentials.
   */
  googleCredentials?: GoogleCredentials;
}

export function createGoogleVertex(
  options: GoogleVertexProviderSettings = {},
): GoogleVertexProvider {
  const apiKey = loadOptionalSetting({
    settingValue: options.apiKey,
    environmentVariableName: 'GOOGLE_VERTEX_API_KEY',
  });

  if (apiKey) {
    return createGoogleVertexOriginal(options);
  }

  return createGoogleVertexOriginal({
    ...options,
    headers: async () => ({
      Authorization: `Bearer ${await generateAuthToken(
        options.googleCredentials,
      )}`,
      ...(await resolve(options.headers)),
    }),
  });
}

/**
 * Default Google Vertex AI provider instance.
 */
export const googleVertex = createGoogleVertex();
