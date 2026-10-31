import type { JSONArray, JSONValue } from '../../json-value';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';
import type { ImageModelV4Usage } from './image-model-v4-usage';

export type ImageModelV4ProviderMetadata = Record<
  string,
  {
    images: JSONArray;
  } & JSONValue
>;

/**
 * The result of an image model doGenerate call.
 */
export type ImageModelV4Result = {
  /**
   * Generated images as base64 encoded strings or binary data.
   * The images should be returned without any unnecessary conversion.
   * If the API returns base64 encoded strings, the images should be returned
   * as base64 encoded strings. If the API returns binary data, the images should
   * be returned as binary data.
   */
  images: Array<string> | Array<Uint8Array>;

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
   * record is provider-specific metadata. It always includes an
   * `images` key with image-specific metadata
   *
   * ```ts
   * {
   * "openai": {
   * "images": ["revisedPrompt": "Revised prompt here."]
   * }
   * }
   * ```
   */
  providerMetadata?: ImageModelV4ProviderMetadata;

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

  /**
   * Optional token usage for the image generation call (if the provider reports it).
   */
  usage?: ImageModelV4Usage;
};
