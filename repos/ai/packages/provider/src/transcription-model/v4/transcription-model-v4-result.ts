import type { JSONObject } from '../../json-value';
import type { SharedV4Headers } from '../../shared';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';

/**
 * The result of a transcription model doGenerate call.
 */
export type TranscriptionModelV4Result = {
  /**
   * The complete transcribed text from the audio.
   */
  text: string;

  /**
   * Array of transcript segments with timing information.
   * Each segment represents a portion of the transcribed text with start and end times.
   */
  segments: Array<{
    /**
     * The text content of this segment.
     */
    text: string;
    /**
     * The start time of this segment in seconds.
     */
    startSecond: number;
    /**
     * The end time of this segment in seconds.
     */
    endSecond: number;
  }>;

  /**
   * The detected language of the audio content, as an ISO-639-1 code (e.g., 'en' for English).
   * May be undefined if the language couldn't be detected.
   */
  language: string | undefined;

  /**
   * The total duration of the audio file in seconds.
   * May be undefined if the duration couldn't be determined.
   */
  durationInSeconds: number | undefined;

  /**
   * Warnings for the call, e.g. unsupported settings.
   */
  warnings: Array<SharedV4Warning>;

  /**
   * Optional request information for telemetry and debugging purposes.
   */
  request?: {
    /**
     * Raw request HTTP body that was sent to the provider API as a string (JSON should be stringified).
     * Non-HTTP(s) providers should not set this.
     */
    body?: string;
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
    headers?: SharedV4Headers;

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
