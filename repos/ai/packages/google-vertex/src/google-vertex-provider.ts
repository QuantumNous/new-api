import { loadOptionalSetting, resolve } from '@ai-sdk/provider-utils';
import type { GoogleAuthOptions } from 'google-auth-library';
import { createAuthTokenGenerator } from './google-vertex-auth-google-auth-library';
import {
  createGoogleVertex as createGoogleVertexOriginal,
  type GoogleVertexProvider,
  type GoogleVertexProviderSettings as GoogleVertexProviderSettingsOriginal,
} from './google-vertex-provider-base';
export interface GoogleVertexProviderSettings extends GoogleVertexProviderSettingsOriginal {
  /**
   * Optional. The Authentication options provided by google-auth-library.
   * Complete list of authentication options is documented in the
   * GoogleAuthOptions interface:
   * https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/googleauth.ts.
   */
  googleAuthOptions?: GoogleAuthOptions;
}

export type { GoogleVertexProvider };

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

  const googleAuthOptions =
    options.project == null
      ? options.googleAuthOptions
      : {
          projectId: options.project,
          ...options.googleAuthOptions,
        };

  const generateAuthToken = createAuthTokenGenerator(googleAuthOptions);

  return createGoogleVertexOriginal({
    ...options,
    headers: async () => ({
      Authorization: `Bearer ${await generateAuthToken()}`,
      ...(await resolve(options.headers)),
    }),
  });
}

/**
 * Default Google Vertex AI provider instance.
 */
export const googleVertex = createGoogleVertex();
