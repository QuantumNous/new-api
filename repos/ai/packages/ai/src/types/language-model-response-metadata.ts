import type { ResponseMessage } from '../generate-text/response-message';

/**
 * Metadata for a language model response.
 */
export type LanguageModelResponseMetadata = {
  /**
   * The response messages that were generated during the call.
   * Response messages can be either assistant messages or tool messages.
   * They contain a generated id.
   */
  readonly messages: Array<ResponseMessage>;

  /**
   * ID for the generated response.
   */
  readonly id: string;

  /**
   * Timestamp for the start of the generated response.
   */
  readonly timestamp: Date;

  /**
   * The ID of the response model that was used to generate the response.
   */
  readonly modelId: string;

  /**
   * Response headers (available only for providers that use HTTP requests).
   */
  readonly headers?: Record<string, string>;

  /**
   * Response body (available only for providers that use HTTP requests).
   */
  readonly body?: unknown;
};
