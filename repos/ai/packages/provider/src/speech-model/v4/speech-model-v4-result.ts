import type { JSONObject } from '../../json-value';
import type { SharedV2Headers } from '../../shared';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';

/**
 * The result of a speech model doGenerate call.
 */
export type SpeechModelV4Result = {
  /**
   * Generated audio as an ArrayBuffer.
   * The audio should be returned without any unnecessary conversion.
   * If the API returns base64 encoded strings, the audio should be returned
   * as base64 encoded strings. If the API returns binary data, the audio
   * should be returned as binary data.
   */
  audio: string | Uint8Array;

  /**
   * Warnings for the call, e.g. unsupported settings.
   */
  warnings: Array<SharedV4Warning>;

  /**
   * Optional request information for telemetry and debugging purposes.
   */
  request?: {
    /**
     * Response body (available only for providers that use HTTP requests).
     */
    body?: unknown;
  };

  /**
   * Response information for telemetry and debugging purposes.
   */
  response: {
    /**
     * Timestamp for the start of the generated response.
     */
    timestamp: Date;

    /**
     * The ID of the response model that was used to generate the response.
     */
    modelId: string;

    /**
     * Response headers.
     */
    headers?: SharedV2Headers;

    /**
     * Response body.
     */
    body?: unknown;
  };

  /**
   * Additional provider-specific metadata. They are passed through
   * from the provider to the AI SDK and enable provider-specific
   * results that can be fully encapsulated in the provider.
   */
  providerMetadata?: Record<string, JSONObject>;
};
