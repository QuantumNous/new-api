import type { SharedV4Headers } from '../../shared';
import type { LanguageModelV4StreamPart } from './language-model-v4-stream-part';

/**
 * The result of a language model doStream call.
 */
export type LanguageModelV4StreamResult = {
  /**
   * The stream.
   */
  stream: ReadableStream<LanguageModelV4StreamPart>;

  /**
   * Optional request information for telemetry and debugging purposes.
   */
  request?: {
    /**
     * Request HTTP body that was sent to the provider API.
     */
    body?: unknown;
  };

  /**
   * Optional response data.
   */
  response?: {
    /**
     * Response headers.
     */
    headers?: SharedV4Headers;
  };
};
