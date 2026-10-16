import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';

/**
 * Generated video data. Can be a URL, base64-encoded string, or binary data.
 */
export type VideoModelV4VideoData =
  | {
      /**
       * Video available as a URL (most common for video providers).
       */
      type: 'url';
      url: string;
      mediaType: string;
    }
  | {
      /**
       * Video as base64-encoded string.
       */
      type: 'base64';
      data: string;
      mediaType: string;
    }
  | {
      /**
       * Video as binary data.
       */
      type: 'binary';
      data: Uint8Array;
      mediaType: string;
    };

/**
 * The result of a video model doGenerate call.
 */
export type VideoModelV4Result = {
  /**
   * Generated videos as URLs, base64 strings, or binary data.
   *
   * Most providers return URLs to video files (MP4, WebM) due to large file sizes.
   * Use the discriminated union to indicate the type of video data being returned.
   */
  videos: Array<VideoModelV4VideoData>;

  /**
   * Warnings for the call, e.g. unsupported features.
   */
  warnings: Array<SharedV4Warning>;

  /**
   * Additional provider-specific metadata. They are passed through
   * from the provider to the AI SDK and enable provider-specific
   * results that can be fully encapsulated in the provider.
   *
   * The outer record is keyed by the provider name, and the inner
   * record is provider-specific metadata.
   *
   * ```ts
   * {
   *   "fal": {
   *     "videos": [{
   *       "duration": 5.0,
   *       "fps": 24,
   *       "width": 1280,
   *       "height": 720
   *     }]
   *   }
   * }
   * ```
   */
  providerMetadata?: SharedV4ProviderMetadata;

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
    headers: Record<string, string> | undefined;
  };
};
