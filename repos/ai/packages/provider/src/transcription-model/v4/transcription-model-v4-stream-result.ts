import type { SharedV4Headers } from '../../shared';
import type { TranscriptionModelV4StreamPart } from './transcription-model-v4-stream-part';

/**
 * The result of a transcription model doStream call.
 */
export type TranscriptionModelV4StreamResult = {
  /**
   * The stream.
   */
  stream: ReadableStream<TranscriptionModelV4StreamPart>;

  /**
   * Optional request information for telemetry and debugging purposes.
   */
  request?: {
    /**
     * Request body or setup payload that was sent to the provider API.
     */
    body?: unknown;
  };

  /**
   * Optional response data.
   */
  response?: {
    /**
     * Timestamp for the start of the streamed response.
     */
    timestamp?: Date;

    /**
     * The ID of the response model that was used to generate the response.
     */
    modelId?: string;

    /**
     * Response headers.
     */
    headers?: SharedV4Headers;

    /**
     * Response body.
     */
    body?: unknown;
  };
};
