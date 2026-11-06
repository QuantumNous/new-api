import { resolve } from '@ai-sdk/provider-utils';
import {
  generateAuthToken as defaultGenerateAuthToken,
  type GoogleCredentials,
} from '../../edge/google-vertex-auth-edge';
import {
  createGoogleVertexAnthropic as createVertexAnthropicOriginal,
  type GoogleVertexAnthropicProvider,
  type GoogleVertexAnthropicProviderSettings as GoogleVertexAnthropicProviderSettingsOriginal,
} from '../google-vertex-anthropic-provider';
export type { GoogleVertexAnthropicProvider };

export interface GoogleVertexAnthropicProviderSettings extends GoogleVertexAnthropicProviderSettingsOriginal {
  /**
   * Optional. The Google credentials for the Google Cloud service account. If
   * not provided, the Google Vertex provider will use environment variables to
   * load the credentials.
   */
  googleCredentials?: GoogleCredentials;
  /**
   * Optional. Override the Bearer token generator. Defaults to OAuth exchange
   * with `googleCredentials`.
   */
  generateAuthToken?: () => Promise<string>;
}

export function createGoogleVertexAnthropic(
  options: GoogleVertexAnthropicProviderSettings = {},
): GoogleVertexAnthropicProvider {
  const generateAuthToken =
    options.generateAuthToken ??
    (() => defaultGenerateAuthToken(options.googleCredentials));
  return createVertexAnthropicOriginal({
    ...options,
    headers: async () => ({
      Authorization: `Bearer ${await generateAuthToken()}`,
      ...(await resolve(options.headers)),
    }),
  });
}

/**
 * Default Google Vertex AI Anthropic provider instance.
 */
export const googleVertexAnthropic = createGoogleVertexAnthropic();
